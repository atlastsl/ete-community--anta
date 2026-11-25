import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import ProductionStatus from '#enums/production_status'
import FileStorageService from '#services/file_storage_service'
import ThumbnailService from '#services/thumbnail_service'
import PosterService from '#services/poster_service'
import FeaturedService from '#services/featured_service'
import RankingService from '#services/ranking_service'
import Production from '#models/production'
import { slugify } from '#helpers/slug'

/** Valeurs distinctes existantes (toutes statuts) pour l'auto-complétion du formulaire admin. */
export type ProductionSuggestions = {
  authors: string[]
  tags: string[]
  subdomains: string[]
  categories: string[]
  domains: string[]
  languages: string[]
}

/**
 * Règle d'attachement requise pour publier (FR21).
 * Dupliquée depuis `inertia/lib/production_completion.ts` — le code client n'est pas
 * importable côté serveur (frontière TS). Duplication intentionnelle (cf. double
 * validation VineJS/Zod de l'architecture).
 */
function isAttachmentSatisfied(license: string, hasFile: boolean, hasLink: boolean): boolean {
  if (license === 'external_link') return hasLink
  return hasFile || hasLink
}

const REQUIRED_STRING_FIELDS = [
  'title',
  'category',
  'domain',
  'language',
  'publicationCountry',
  'summary',
] as const

export default class ProductionService {
  /**
   * Slug de base dérivé d'un titre : translittération ASCII (accents retirés), minuscules,
   * non-alphanumériques → tirets, longueur max ~80. Fallback `'production'` si vide.
   * Translittération partagée : `#helpers/slug` (copie figée dans la migration `add_slug_to_productions_table`).
   */
  static generateSlug(title: string): string {
    return slugify(title ?? '') || 'production'
  }

  /**
   * Slug unique en base : `generateSlug(title)`, puis suffixe `-2`, `-3`… en cas de collision.
   * Appelé par le hook `@beforeCreate` du modèle Production (toute création passe par là).
   */
  static async generateUniqueSlug(title: string): Promise<string> {
    const base = this.generateSlug(title)
    let candidate = base
    let n = 2
    while (await Production.findBy('slug', candidate)) {
      candidate = `${base}-${n}`
      n++
    }
    return candidate
  }

  /**
   * Valeurs distinctes existantes (TOUTES statuts confondues) pour suggérer la saisie
   * dans le formulaire admin et éviter les variantes d'orthographe d'une même valeur.
   */
  static async distinctSuggestions(): Promise<ProductionSuggestions> {
    const jsonbValues = async (column: string): Promise<string[]> => {
      const res = await db.rawQuery(
        `select distinct jsonb_array_elements_text(${column}) as v from productions order by v asc`
      )
      return (res.rows as { v: string }[]).map((r) => r.v).filter(Boolean)
    }
    const stringValues = async (column: string): Promise<string[]> => {
      const rows = await Production.query()
        .whereNotNull(column)
        .distinct(column)
        .orderBy(column, 'asc')
      return rows
        .map((row) => (row as unknown as Record<string, string>)[column])
        .filter((v) => v && v.trim() !== '')
    }

    const [authors, tags, subdomains, categories, domains, languages] = await Promise.all([
      jsonbValues('authors'),
      jsonbValues('tags'),
      jsonbValues('subdomain'),
      stringValues('category'),
      stringValues('domain'),
      stringValues('language'),
    ])

    return { authors, tags, subdomains, categories, domains, languages }
  }

  /**
   * Retourne la liste des champs/conditions manquants pour publier (FR21).
   * Tableau vide ⇒ la production est publiable.
   * `authorsCount` = lignes pivot (`ProductionAuthorService.count`, Story 9.7) : les noms de
   * la colonne dénormalisée ne suffisent plus (production non convertie = auteurs manquants).
   */
  static getMissingForPublish(
    production: Production,
    hasFile: boolean,
    hasLink: boolean,
    authorsCount: number
  ): string[] {
    const missing: string[] = []

    for (const field of REQUIRED_STRING_FIELDS) {
      const value = production[field] as string | null
      if (!value || value.trim() === '') missing.push(field)
    }

    if (authorsCount === 0) missing.push('authors')
    if (!production.subdomain || production.subdomain.length === 0) missing.push('subdomain')
    if (!production.tags || production.tags.length === 0) missing.push('tags')
    if (!production.workPublishedAt) missing.push('workPublishedAt')
    if (!isAttachmentSatisfied(production.licenseStatus, hasFile, hasLink)) {
      missing.push('attachment')
    }

    return missing
  }

  /**
   * Publie la production. `anta_published_at` n'est défini qu'à la PREMIÈRE
   * publication (FR35) — conservé ensuite (dépublication/republication).
   * Classements de l'accueil invalidés après le commit de la transaction de l'appelant
   * (`production.$trx`), sinon tout de suite (Story 12.2, D-12.2-3).
   */
  static async publish(production: Production): Promise<void> {
    production.status = ProductionStatus.PUBLISHED
    if (!production.antaPublishedAt) {
      production.antaPublishedAt = DateTime.now()
    }
    await production.save()
    RankingService.invalidateAfterCommit(production.$trx)
  }

  /**
   * Dépublie : retour en brouillon. `anta_published_at` est CONSERVÉ (FR35 —
   * c'est la date de première mise en ligne, pas l'état courant).
   * Une production à la une quitte la sélection dans la même transaction (Story 11.5, FR51) :
   * ligne verrouillée d'abord (`FOR NO KEY UPDATE`, colonne non clé), table de la une ensuite
   * (ordre D-11.4-5) ; le retrait est journalisé après le commit par `FeaturedService`.
   */
  static async unpublish(production: Production, adminId: string): Promise<void> {
    await db.transaction(async (trx) => {
      const query = Production.query({ client: trx }).where('id', production.id)
      query.knexQuery.forNoKeyUpdate()
      const locked = await query.firstOrFail()
      await FeaturedService.removeProduction(locked.id, adminId, 'unpublish', trx)
      locked.status = ProductionStatus.DRAFT
      await locked.save()
      production.status = locked.status
      production.updatedAt = locked.updatedAt
    })
    // Après le commit : un rendu concurrent ne recache pas l'état d'avant (Story 12.2).
    RankingService.invalidate()
  }

  /**
   * Suppression définitive (FR24). Supprime d'abord les fichiers R2 (best-effort —
   * un fichier déjà absent ne doit pas bloquer la suppression RGPD), puis la
   * production (CASCADE supprime `production_files` + `production_links`).
   */
  static async delete(production: Production, adminId: string): Promise<void> {
    await production.load('files')
    for (const file of production.files) {
      try {
        await FileStorageService.delete(file.fileKey)
      } catch (error) {
        logger.error(
          { err: error, fileKey: file.fileKey },
          'R2 delete failed during production delete'
        )
      }
    }
    // Clés réellement supprimées (`RETURNING`), pas celles lues plus haut : une vignette, un
    // poster ou un fichier enregistrés entre-temps ne restent pas orphelins dans R2 (revue
    // 11.3). Une écriture concurrente verrouille la ligne : le DELETE attend puis renvoie la
    // version écrite ; une écriture postérieure ne trouve plus de ligne (poster jeté par
    // `PosterService.attach`).
    const deleted = await db.transaction(async (trx) => {
      // Story 11.5 (FR51) : ligne verrouillée d'abord, puis retrait de la une (verrou de table,
      // ordre D-11.4-5), AVANT le DELETE : le CASCADE retirerait l'emplacement sans journal.
      const locked = await trx.rawQuery('SELECT id FROM productions WHERE id = ? FOR UPDATE', [
        production.id,
      ])
      if (locked.rows.length > 0) {
        await FeaturedService.removeProduction(production.id, adminId, 'delete', trx)
      }
      const files = await trx.rawQuery(
        'DELETE FROM production_files WHERE production_id = ? RETURNING file_key, poster_key',
        [production.id]
      )
      const rows = await trx.rawQuery(
        'DELETE FROM productions WHERE id = ? RETURNING thumbnail_key',
        [production.id]
      )
      return {
        files: files.rows as { file_key: string; poster_key: string | null }[],
        thumbnailKey: (rows.rows[0]?.thumbnail_key ?? null) as string | null,
      }
    })
    production.$isDeleted = true
    RankingService.invalidate() // après le commit (Story 12.2)

    const alreadyDeleted = new Set(production.files.map((file) => file.fileKey))
    for (const file of deleted.files) {
      if (alreadyDeleted.has(file.file_key)) continue
      await FileStorageService.delete(file.file_key).catch((error) =>
        logger.error(
          { err: error, fileKey: file.file_key },
          'R2 delete failed during production delete'
        )
      )
    }
    // Variantes de la vignette (Story 11.1) et images extraites des vidéos (Story 11.3) :
    // après la suppression, best-effort (journalisé).
    await ThumbnailService.discard(deleted.thumbnailKey)
    for (const file of deleted.files) await PosterService.discard(file.poster_key)
  }
}
