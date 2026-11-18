import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Production from '#models/production'
import ProductionStatus, {
  type ProductionStatus as ProductionStatusType,
} from '#enums/production_status'
import LicenseStatus from '#enums/license_status'
import ActionType from '#enums/action_type'
import AdminActivityLog from '#models/admin_activity_log'
import ActivityLogService from '#services/activity_log_service'
import db from '@adonisjs/lucid/services/db'
import AuthorService from '#services/author_service'
import AuthorConversionService from '#services/author_conversion_service'
import ProductionAuthorService from '#services/production_author_service'
import ProductionService from '#services/production_service'
import StatsService from '#services/stats_service'
import {
  draftProductionValidator,
  assertProductionTaxonomy,
} from '#validators/admin/production_validator'
import { PRODUCTION_CATEGORIES, PRODUCTION_DOMAINS } from '#constants/production_taxonomy'

const PER_PAGE = 20

/** Parse une date `YYYY-MM-DD` validée en DateTime, ou null si absente/invalide (ex. 2024-13-45). */
function parseWorkDate(value: string | undefined): DateTime | null {
  if (!value) return null
  const dt = DateTime.fromISO(value)
  return dt.isValid ? dt : null
}

/**
 * Colonne dénormalisée non vide (noms textuels ou valeur non textuelle) : même règle que la
 * conversion (`AuthorConversionService.inspectAuthors`).
 */
function hasLegacyAuthors(value: unknown): boolean {
  const { names, nonText } = AuthorConversionService.inspectAuthors(value)
  return names.length > 0 || nonText !== null
}

/** Query param texte → string non vide ou null. */
function strInput(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

export default class ProductionsController {
  async index({ request, inertia }: HttpContext) {
    // Bornage : évite un OFFSET négatif (?page=-1 → 500 Postgres) ou non numérique.
    const page = Math.max(1, Number(request.input('page', 1)) || 1)

    // Filtre statut validé contre l'enum (pas de string en dur, pas d'injection via query param)
    const statusInput = request.input('status')
    const status = (Object.values(ProductionStatus) as string[]).includes(statusInput)
      ? (statusInput as ProductionStatusType)
      : null

    const q = strInput(request.input('q'))
    const category = strInput(request.input('category'))
    const domain = strInput(request.input('domain'))
    const language = strInput(request.input('language'))

    const query = Production.query()
    if (q) {
      // Recherche full-text (toutes statuts) via le même search_vector que le site public.
      query.whereRaw("search_vector @@ websearch_to_tsquery('simple', ?)", [q])
      query.orderByRaw("ts_rank(search_vector, websearch_to_tsquery('simple', ?)) desc", [q])
    } else {
      query.orderBy('updatedAt', 'desc')
    }
    query.orderBy('id', 'asc')

    if (status) query.where('status', status)
    if (category) query.where('category', category)
    if (domain) query.where('domain', domain)
    if (language) query.where('language', language)

    const paginator = await query.paginate(page, PER_PAGE)
    const meta = paginator.getMeta()
    const options = await ProductionService.distinctSuggestions()

    return inertia.render('admin/Productions/Index', {
      productions: paginator.all().map((p) => ({
        id: p.id,
        title: p.title,
        authors: p.authorNames ?? [],
        category: p.category,
        status: p.status,
        updatedAt: p.updatedAt?.toISO() ?? null,
      })),
      pagination: {
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
        total: meta.total,
        perPage: meta.perPage,
      },
      currentStatus: status,
      q,
      currentCategory: category,
      currentDomain: domain,
      currentLanguage: language,
      filterOptions: {
        categories: [...PRODUCTION_CATEGORIES],
        domains: [...PRODUCTION_DOMAINS],
        languages: options.languages,
      },
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('admin/Productions/Create', {
      suggestions: await ProductionService.distinctSuggestions(),
    })
  }

  async edit({ params, inertia }: HttpContext) {
    const production = await Production.query()
      .where('id', params.id)
      .preload('files')
      .preload('links')
      .preload('authors', (query) => query.preload('affiliations'))
      .firstOrFail()

    // Dernier admin ayant publié + date/heure — dérivé des logs d'activité (pas de colonne dédiée).
    const lastPublish = await AdminActivityLog.query()
      .where('resourceType', 'production')
      .where('resourceId', production.id)
      .where('actionType', ActionType.PUBLISH)
      .preload('adminUser')
      .orderBy('createdAt', 'desc')
      .first()
    const publishedBy = lastPublish
      ? { email: lastPublish.adminUser?.email ?? null, at: lastPublish.createdAt.toISO() ?? '' }
      : null

    // Statistiques par production (FR27) — totaux + évolution 30j + dates clés.
    const aggregated = await StatsService.productionStats(production.id)
    const stats = {
      ...aggregated,
      firstPublishedAt: production.antaPublishedAt?.toISO() ?? null,
      lastModifiedAt: production.updatedAt?.toISO() ?? null,
    }

    // Auteurs relus depuis le pivot, dans l'ordre (Story 9.7). Noms de la colonne qu'aucune
    // fiche liée ne porte (production non convertie ou partiellement rattachée) et valeurs
    // non textuelles : avertissement « Auteurs à rattacher » (conservés tant que la sélection
    // n'est pas modifiée, D-9.7-k).
    const authors = await AuthorService.toPickerAuthors(production.authors)
    const legacy = ProductionAuthorService.legacyOf(
      production.authorNames,
      production.authors.map((author) => author.searchName)
    )

    return inertia.render('admin/Productions/Edit', {
      publishedBy,
      stats,
      legacyAuthorNames: legacy.unlinkedNames,
      legacyAuthorsNonText: legacy.nonText,
      production: {
        id: production.id,
        status: production.status,
        title: production.title,
        summary: production.summary ?? '',
        authors,
        tags: production.tags ?? [],
        category: production.category ?? '',
        domain: production.domain ?? '',
        subdomain: production.subdomain ?? [],
        language: production.language ?? '',
        publicationCountry: production.publicationCountry ?? '',
        journal: production.journal ?? '',
        publisher: production.publisher ?? '',
        isbnDoiIssn: production.isbnDoiIssn ?? '',
        institution: production.institution ?? '',
        licenseStatus: production.licenseStatus,
        workPublishedAt: production.workPublishedAt?.toFormat('yyyy-MM-dd') ?? '',
      },
      files: production.files.map((f) => ({
        id: f.id,
        originalName: f.originalName,
        sizeBytes: f.sizeBytes,
        mimeType: f.mimeType,
      })),
      links: production.links.map((l) => ({
        id: l.id,
        url: l.url,
        linkType: l.linkType,
        label: l.label,
      })),
      suggestions: await ProductionService.distinctSuggestions(),
    })
  }

  async update({ params, request, auth, response, session }: HttpContext) {
    const existing = await Production.findOrFail(params.id)
    const data = await request.validateUsing(draftProductionValidator)
    assertProductionTaxonomy(data)

    // Une seule transaction : métadonnées, auteurs (pivot + colonne dénormalisée) et
    // dépublication automatique ; un auteur inconnu annule tout (erreur de validation).
    const { production, autoUnpublished } = await db.transaction(async (trx) => {
      const locked = await Production.query({ client: trx })
        .where('id', existing.id)
        .forUpdate()
        .firstOrFail()

      // `status` n'est JAMAIS modifié ici (FR22 — pas de republication automatique).
      // `authorNames` n'est jamais écrit depuis la requête (Story 9.7) : `data.authors` est
      // ignoré, seul ProductionAuthorService écrit la colonne dénormalisée.
      locked.title = data.title
      locked.summary = data.summary ?? null
      locked.tags = data.tags ?? []
      locked.category = data.category ?? null
      locked.domain = data.domain ?? null
      locked.subdomain = data.subdomain ?? []
      locked.language = data.language ?? null
      locked.publicationCountry = data.publicationCountry ?? null
      locked.journal = data.journal ?? null
      locked.publisher = data.publisher ?? null
      locked.isbnDoiIssn = data.isbnDoiIssn ?? null
      locked.institution = data.institution ?? null
      locked.licenseStatus = data.licenseStatus ?? locked.licenseStatus
      locked.workPublishedAt = parseWorkDate(data.workPublishedAt)

      // `authorIds` absent (ancien client, PUT partiel) → auteurs inchangés.
      const sync =
        data.authorIds === undefined
          ? null
          : await ProductionAuthorService.sync(locked.id, data.authorIds, trx)

      // Intégrité du catalogue public : si une production PUBLIÉE devient incomplète
      // suite à l'édition, on la dépublie automatiquement (sinon le site public — Epic 5 —
      // exposerait un item publié cassé). `status` n'est sinon jamais modifié ici (FR22).
      let unpublished = false
      if (locked.status === ProductionStatus.PUBLISHED) {
        await locked.loadCount('files')
        await locked.loadCount('links')
        const hasFile = Number(locked.$extras.files_count) > 0
        const hasLink = Number(locked.$extras.links_count) > 0
        const authorsCount = await ProductionAuthorService.count(locked.id, trx)
        let missing = ProductionService.getMissingForPublish(locked, hasFile, hasLink, authorsCount)
        // Production non convertie (noms conservés, aucun lien) : pas de dépublication pour
        // le seul critère « auteurs » — la conversion (9.6) la rattachera.
        if (authorsCount === 0 && (sync?.protected ?? hasLegacyAuthors(locked.authorNames))) {
          missing = missing.filter((field) => field !== 'authors')
        }
        if (missing.length > 0) {
          locked.status = ProductionStatus.DRAFT
          unpublished = true
        }
      }

      await locked.save()
      return { production: locked, autoUnpublished: unpublished }
    })

    await ActivityLogService.log({
      adminUserId: auth.user!.id,
      actionType: ActionType.UPDATE,
      resourceType: 'production',
      resourceId: production.id,
    })
    if (autoUnpublished) {
      await ActivityLogService.log({
        adminUserId: auth.user!.id,
        actionType: ActionType.UNPUBLISH,
        resourceType: 'production',
        resourceId: production.id,
      })
    }

    session.flash(
      'success',
      autoUnpublished ? 'productions.auto_unpublished' : 'productions.update_success'
    )
    return response.redirect(`/admin/productions/${production.id}/edit`)
  }

  async unpublish({ params, auth, response, session }: HttpContext) {
    const production = await Production.findOrFail(params.id)

    await ProductionService.unpublish(production)

    await ActivityLogService.log({
      adminUserId: auth.user!.id,
      actionType: ActionType.UNPUBLISH,
      resourceType: 'production',
      resourceId: production.id,
    })

    session.flash('success', 'productions.unpublish_success')
    return response.redirect().back()
  }

  async destroy({ params, auth, response, session }: HttpContext) {
    const production = await Production.findOrFail(params.id)

    // Log AVANT suppression (le log appartient à l'acteur, non affecté par le CASCADE).
    await ActivityLogService.log({
      adminUserId: auth.user!.id,
      actionType: ActionType.DELETE,
      resourceType: 'production',
      resourceId: production.id,
    })

    await ProductionService.delete(production)

    session.flash('success', 'productions.delete_success')
    return response.redirect('/admin/productions')
  }

  async store({ request, auth, response, session }: HttpContext) {
    const data = await request.validateUsing(draftProductionValidator)
    assertProductionTaxonomy(data)

    // Création et auteurs dans une transaction : un auteur inconnu annule la création.
    // `data.authors` (ancienne saisie libre) est ignoré : la colonne dénormalisée est écrite
    // par ProductionAuthorService.sync depuis le pivot (Story 9.7).
    const production = await db.transaction(async (trx) => {
      const created = await Production.create(
        {
          title: data.title,
          summary: data.summary ?? null,
          authorNames: [],
          tags: data.tags ?? [],
          category: data.category ?? null,
          domain: data.domain ?? null,
          subdomain: data.subdomain ?? [],
          language: data.language ?? null,
          publicationCountry: data.publicationCountry ?? null,
          journal: data.journal ?? null,
          publisher: data.publisher ?? null,
          isbnDoiIssn: data.isbnDoiIssn ?? null,
          institution: data.institution ?? null,
          licenseStatus: data.licenseStatus ?? LicenseStatus.MEMBER,
          status: ProductionStatus.DRAFT,
          workPublishedAt: parseWorkDate(data.workPublishedAt),
          createdById: auth.user!.id,
        },
        { client: trx }
      )
      await ProductionAuthorService.sync(created.id, data.authorIds ?? [], trx)
      return created
    })

    await ActivityLogService.log({
      adminUserId: auth.user!.id,
      actionType: ActionType.CREATE,
      resourceType: 'production',
      resourceId: production.id,
    })

    session.flash('success', 'productions.draft_saved')
    return response.redirect(`/admin/productions/${production.id}/edit`)
  }

  async publish({ params, auth, response, session }: HttpContext) {
    const existing = await Production.findOrFail(params.id)

    // Contrôle et publication sur la ligne verrouillée : une édition concurrente (auteurs
    // retirés, champ vidé) ne peut pas se glisser entre la vérification et la publication.
    const published = await db.transaction(async (trx) => {
      const production = await Production.query({ client: trx })
        .where('id', existing.id)
        .forUpdate()
        .firstOrFail()
      await production.loadCount('files')
      await production.loadCount('links')
      const hasFile = Number(production.$extras.files_count) > 0
      const hasLink = Number(production.$extras.links_count) > 0

      // Revalidation serveur (anti-contournement du bouton désactivé) — FR21.
      // Le message d'erreur est flashé sur `error` → toast rouge persistant (AdminLayout).
      // Le détail des champs manquants reste visible via le CompletionIndicator (orange).
      const authorsCount = await ProductionAuthorService.count(production.id, trx)
      const missing = ProductionService.getMissingForPublish(
        production,
        hasFile,
        hasLink,
        authorsCount
      )
      if (missing.length > 0) return false

      await ProductionService.publish(production)
      return true
    })

    if (!published) {
      session.flash('error', 'productions.publish.incomplete')
      return response.redirect().back()
    }

    await ActivityLogService.log({
      adminUserId: auth.user!.id,
      actionType: ActionType.PUBLISH,
      resourceType: 'production',
      resourceId: existing.id,
    })

    session.flash('success', 'productions.published')
    return response.redirect().back()
  }
}
