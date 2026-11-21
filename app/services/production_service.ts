import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import ProductionStatus from '#enums/production_status'
import FileStorageService from '#services/file_storage_service'
import ThumbnailService from '#services/thumbnail_service'
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
   */
  static async publish(production: Production): Promise<void> {
    production.status = ProductionStatus.PUBLISHED
    if (!production.antaPublishedAt) {
      production.antaPublishedAt = DateTime.now()
    }
    await production.save()
  }

  /**
   * Dépublie : retour en brouillon. `anta_published_at` est CONSERVÉ (FR35 —
   * c'est la date de première mise en ligne, pas l'état courant).
   */
  static async unpublish(production: Production): Promise<void> {
    production.status = ProductionStatus.DRAFT
    await production.save()
  }

  /**
   * Suppression définitive (FR24). Supprime d'abord les fichiers R2 (best-effort —
   * un fichier déjà absent ne doit pas bloquer la suppression RGPD), puis la
   * production (CASCADE supprime `production_files` + `production_links`).
   */
  static async delete(production: Production): Promise<void> {
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
    await production.delete()
    // Variantes de la vignette (Story 11.1) : après la suppression, best-effort (journalisé).
    await ThumbnailService.discard(production.thumbnailKey)
  }
}
