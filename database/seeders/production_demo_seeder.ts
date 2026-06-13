import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { PRODUCTION_DOMAINS, SUBDOMAINS_BY_DOMAIN } from '#constants/production_taxonomy'
import Production from '#models/production'
import ProductionService from '#services/production_service'

/**
 * Seeder de DÉMO (QA) — 300 productions : 250 publiées, 30 dépubliées, 20 brouillons.
 *
 * Données variées (catégorie/domaine/sous-domaine/langue/pays/licence/auteurs) pour
 * éprouver recherche full-text, filtres multi-critères, tri et pagination du site public.
 * Compteurs de vues/téléchargements générés pour les publiées (sections « plus consultées »
 * + tri vues/téléchargements).
 *
 * Marqueur `institution = 'SEED_DEMO'` → idempotent : un re-run purge d'abord les données
 * de démo (CASCADE nettoie les stats), sans toucher aux productions réelles.
 *
 * Lancer : node ace db:seed --files=./database/seeders/production_demo_seeder.ts
 */
const MARKER = 'SEED_DEMO'

const CATEGORIES = [
  'book',
  'article',
  'thesis',
  'report',
  'memoir',
  'conference_proceedings',
] as const
const DOMAINS = PRODUCTION_DOMAINS
const LANGUAGES = ['fr', 'en']
const COUNTRIES = [
  'Sénégal',
  'France',
  "Côte d'Ivoire",
  'Cameroun',
  'Burkina Faso',
  'Mali',
  'Bénin',
]
const LICENSES = ['member', 'free_license', 'external_link'] as const
const AUTHORS = [
  'Cheikh Anta Diop',
  'Aminata Sow Fall',
  'Léopold Sédar Senghor',
  'Mariama Bâ',
  'Ousmane Sembène',
  'Kofi Annan',
  'Wangari Maathai',
  'Chinua Achebe',
  'Fatou Diome',
  'Felwine Sarr',
  'Achille Mbembe',
  'Boubacar Boris Diop',
]
const TITLE_A = [
  'Introduction à',
  'Études sur',
  'Histoire de',
  'Analyse de',
  'Fondements de',
  'Perspectives sur',
  'Manuel de',
  'Recherches en',
  'Essai sur',
  'Traité de',
]
const TITLE_B = [
  'la topologie',
  "l'intelligence artificielle",
  'la génétique',
  'la civilisation africaine',
  "l'économie du développement",
  'la linguistique bantoue',
  "l'histoire médiévale",
  'les réseaux de neurones',
  "l'écologie tropicale",
  "l'algèbre moderne",
  'la philosophie ubuntu',
  'la littérature francophone',
]

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

type Row = Partial<Production> & { status: 'draft' | 'published' | 'unpublished' }

function buildRow(i: number, status: Row['status']): Record<string, unknown> {
  const authors = [pick(AUTHORS), ...(Math.random() < 0.4 ? [pick(AUTHORS)] : [])]
  const isPublished = status === 'published'
  const isUnpublished = status === 'unpublished'

  // anta_published_at : défini pour publiées ET dépubliées (FR35 — conservé après dépublication), null pour brouillon
  const antaPublishedAt =
    isPublished || isUnpublished ? DateTime.now().minus({ days: randInt(1, 720) }) : null

  // Le `(vol. i+1)` rend chaque titre unique → slug unique sans collision (i unique sur 0..299).
  const title = `${pick(TITLE_A)} ${pick(TITLE_B)} (vol. ${i + 1})`

  const domain = pick(DOMAINS)
  const domainSubs = SUBDOMAINS_BY_DOMAIN[domain]
  const subPick = pick(domainSubs)

  return {
    title,
    slug: ProductionService.generateSlug(title),
    summary: `Document académique portant sur ${subPick.replace(/_/g, ' ')}. Ressource de référence pour les chercheurs et étudiants. Réf. ${i + 1}.`,
    authors: JSON.stringify(authors),
    tags: JSON.stringify([subPick, domain]),
    category: pick(CATEGORIES),
    domain,
    subdomain: JSON.stringify([subPick, ...(Math.random() < 0.3 ? [pick(domainSubs)] : [])]),
    language: pick(LANGUAGES),
    publication_country: pick(COUNTRIES),
    journal: null,
    publisher: pick(['Presses Universitaires', 'Éditions Khoudia', "L'Harmattan", null]),
    isbn_doi_issn: null,
    institution: MARKER,
    license_status: pick(LICENSES),
    status,
    work_published_at: DateTime.now()
      .minus({ days: randInt(30, 11000) })
      .toFormat('yyyy-MM-dd'),
    anta_published_at: antaPublishedAt ? antaPublishedAt.toSQL({ includeOffset: false }) : null,
    created_by_id: null,
    created_at: DateTime.now().toSQL({ includeOffset: false }),
    updated_at: DateTime.now().toSQL({ includeOffset: false }),
  }
}

export default class extends BaseSeeder {
  static environment = ['development']

  async run() {
    // 1. Purge des données de démo précédentes (CASCADE → stats nettoyées)
    const deleted = await Production.query().where('institution', MARKER).delete()
    console.log(`🧹 ${deleted} production(s) de démo précédente(s) supprimée(s)`)

    // 2. Construction des 300 lignes
    const rows: Record<string, unknown>[] = []
    for (let i = 0; i < 250; i++) rows.push(buildRow(i, 'published'))
    for (let i = 250; i < 280; i++) rows.push(buildRow(i, 'unpublished'))
    for (let i = 280; i < 300; i++) rows.push(buildRow(i, 'draft'))

    // 3. Insertion en lot (multiInsert = un INSERT multi-lignes ; le trigger peuple search_vector).
    //    `?::jsonb` pour authors/tags (colonnes jsonb).
    const inserted: { id: string; status: string }[] = []
    const CHUNK = 50
    for (let c = 0; c < rows.length; c += CHUNK) {
      const chunk = rows.slice(c, c + CHUNK).map((r) => ({
        ...r,
        authors: db.raw('?::jsonb', [r.authors as string]),
        tags: db.raw('?::jsonb', [r.tags as string]),
        subdomain: db.raw('?::jsonb', [r.subdomain as string]),
      }))
      const res = await db.table('productions').multiInsert(chunk).returning(['id', 'status'])
      inserted.push(...(res as { id: string; status: string }[]))
    }
    console.log(`✔ ${inserted.length} productions créées`)

    // 4. Compteurs vues / téléchargements pour les publiées (sections + tri)
    const publishedIds = inserted.filter((r) => r.status === 'published').map((r) => r.id)
    const viewRows: { production_id: string; ip_hash: string }[] = []
    const downloadRows: { production_id: string; ip_hash: string }[] = []
    for (const id of publishedIds) {
      const views = randInt(0, 80)
      const downloads = randInt(0, 30)
      for (let v = 0; v < views; v++)
        viewRows.push({ production_id: id, ip_hash: `seed-v-${id}-${v}` })
      for (let d = 0; d < downloads; d++)
        downloadRows.push({ production_id: id, ip_hash: `seed-d-${id}-${d}` })
    }
    const SCHUNK = 2000
    for (let c = 0; c < viewRows.length; c += SCHUNK) {
      await db.table('stats_views').multiInsert(viewRows.slice(c, c + SCHUNK))
    }
    for (let c = 0; c < downloadRows.length; c += SCHUNK) {
      await db.table('stats_downloads').multiInsert(downloadRows.slice(c, c + SCHUNK))
    }
    console.log(`✔ ${viewRows.length} vues + ${downloadRows.length} téléchargements générés`)
    console.log('✅ Seed démo terminé : 250 publiées, 30 dépubliées, 20 brouillons')
  }
}
