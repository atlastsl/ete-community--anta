import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { PRODUCTION_DOMAINS, SUBDOMAINS_BY_DOMAIN } from '#constants/production_taxonomy'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import Production from '#models/production'
import ProductionAuthorService from '#services/production_author_service'
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
 * de démo (CASCADE nettoie les stats et le pivot), sans toucher aux productions réelles.
 *
 * Auteurs (Story 9.7) : fiches fictives (noms inventés) marquées `migration_key = 'seed-demo:<n>'`,
 * 1 ou 2 affiliations, un tiers à consentement confirmé ; chaque production est rattachée par
 * `ProductionAuthorService.sync` (pivot et colonne dénormalisée `productions.authors` cohérents).
 * Purge : productions de démo d'abord, puis fiches `seed-demo:` (celles qu'un admin aurait liées
 * à une vraie production sont conservées).
 *
 * Statistiques datées (Story 12.5) : `recorded_at` / `downloaded_at` tirés au hasard sur les
 * 540 derniers jours, jamais avant la publication sur Anta de la production → la fenêtre de 365 j
 * des classements de l'accueil est réellement exercée (une partie des stats tombe hors fenêtre).
 *
 * Base LOCALE uniquement, jamais la base partagée : `environment = ['development']` ne suffit
 * pas (l'environnement de dev peut pointer vers la base partagée) → `run()` refuse tout hôte de
 * base qui n'est pas la boucle locale (`assertLocalDatabase`). Volontairement strict : un nom de
 * service Docker (`postgres`, `db`) ou un socket Unix est refusé aussi (publier le port du
 * conteneur sur 127.0.0.1). Limite connue : un tunnel `localhost` vers une base distante n'est
 * pas détecté.
 *
 * Lancer : node ace db:seed --files=./database/seeders/production_demo_seeder.ts
 */
const MARKER = 'SEED_DEMO'

/** Période sur laquelle les vues / téléchargements de démo sont datés (Story 12.5). */
export const STATS_SPREAD_DAYS = 540

/** Hôtes de base acceptés par le seeder : la boucle locale seulement (conteneur Docker local, CI). */
export const LOCAL_DB_HOSTS = ['localhost', '127.0.0.1', '::1'] as const

/**
 * Refuse toute base qui n'est pas locale (Story 12.5) : le seeder purge et écrit des données
 * factices, il ne doit jamais toucher une base partagée.
 */
export function assertLocalDatabase(host: string | undefined | null): void {
  if (!host || !(LOCAL_DB_HOSTS as readonly string[]).includes(host)) {
    throw new Error(
      `Seeder de démo refusé : base non locale (hôte « ${host ?? '?'} »). ` +
        `Hôtes acceptés : ${LOCAL_DB_HOSTS.join(', ')}.`
    )
  }
}

/**
 * Date aléatoire uniforme entre `max(now - STATS_SPREAD_DAYS, publishedAt)` et `now` (Story 12.5) :
 * jamais avant la publication sur Anta, jamais dans le futur.
 */
export function randomStatDate(
  publishedAt: DateTime | null,
  now: DateTime = DateTime.now()
): DateTime {
  const floor = now.minus({ days: STATS_SPREAD_DAYS })
  const from = publishedAt && publishedAt > floor ? publishedAt : floor
  const start = Math.min(from.toMillis(), now.toMillis()) // a future date is clamped to now
  return DateTime.fromMillis(start + Math.floor(Math.random() * (now.toMillis() - start)))
}

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
/** Marqueur des fiches auteurs de démo (`authors.migration_key`). */
export const SEED_AUTHOR_PREFIX = 'seed-demo:'
const SEED_AUTHOR_COUNT = 24
// Noms inventés (dépôt public) : aucune personne réelle.
const SEED_FIRST_NAMES = ['Awa', 'Koffi', 'Mariam', 'Sékou', 'Nafi', 'Yao', 'Binta', 'Idrissa']
const SEED_LAST_NAMES = ['Démoville', 'Exemplaire', 'Fictivé']
const SEED_INSTITUTIONS = [
  'Université Démo de Thiès',
  'Institut Exemple des Sciences',
  'École Fictive de Bamako',
  'Université Modèle de Lomé',
]
const SEED_DEPARTMENTS = ['Mathématiques', 'Histoire', 'Biologie', null]

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
    // Rempli depuis le pivot par ProductionAuthorService.sync (étape 4).
    authors: JSON.stringify([]),
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
    // timestamptz : ISO avec décalage, juste quel que soit le fuseau de Node.
    anta_published_at: antaPublishedAt ? antaPublishedAt.toISO() : null,
    created_by_id: null,
    created_at: DateTime.now().toSQL({ includeOffset: false }),
    updated_at: DateTime.now().toSQL({ includeOffset: false }),
  }
}

/** 1 à 3 auteurs distincts, ordre aléatoire. */
function pickAuthorIds(ids: string[]): string[] {
  const count = Math.random() < 0.5 ? 1 : Math.random() < 0.7 ? 2 : 3
  const pool = [...ids]
  const picked: string[] = []
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(randInt(0, pool.length - 1), 1)[0])
  }
  return picked
}

export default class extends BaseSeeder {
  static environment = ['development']

  async run() {
    // 0. Base locale uniquement (Story 12.5).
    const connection = db.getRawConnection(this.client.connectionName)?.config.connection as
      | { host?: string }
      | string
      | undefined
    assertLocalDatabase(typeof connection === 'object' ? connection?.host : undefined)

    // 1. Purge des données de démo précédentes : productions (CASCADE → stats, pivot), puis
    //    fiches `seed-demo:` qui ne sont plus liées à aucune production (FK RESTRICT).
    const deleted = await Production.query({ client: this.client })
      .where('institution', MARKER)
      .delete()
    console.log(`🧹 ${deleted} production(s) de démo précédente(s) supprimée(s)`)
    const deletedAuthors = await Author.query({ client: this.client })
      .whereLike('migration_key', `${SEED_AUTHOR_PREFIX}%`)
      .whereNotExists((sub) =>
        sub.from('production_authors').whereColumn('production_authors.author_id', 'authors.id')
      )
      .delete()
    console.log(`🧹 ${deletedAuthors} fiche(s) auteur de démo supprimée(s)`)

    // 2. Fiches auteurs fictives (reprises si une fiche liée ailleurs a survécu à la purge).
    const authorIds = await this.seedAuthors()
    console.log(`✔ ${authorIds.length} fiches auteurs de démo`)

    // 3. Construction des 300 lignes
    const rows: Record<string, unknown>[] = []
    for (let i = 0; i < 250; i++) rows.push(buildRow(i, 'published'))
    for (let i = 250; i < 280; i++) rows.push(buildRow(i, 'unpublished'))
    for (let i = 280; i < 300; i++) rows.push(buildRow(i, 'draft'))

    // 4. Insertion en lot (multiInsert = un INSERT multi-lignes ; le trigger peuple search_vector).
    //    `?::jsonb` pour authors/tags (colonnes jsonb).
    const inserted: { id: string; status: string; anta_published_at: Date | null }[] = []
    const CHUNK = 50
    for (let c = 0; c < rows.length; c += CHUNK) {
      const chunk = rows.slice(c, c + CHUNK).map((r) => ({
        ...r,
        authors: db.raw('?::jsonb', [r.authors as string]),
        tags: db.raw('?::jsonb', [r.tags as string]),
        subdomain: db.raw('?::jsonb', [r.subdomain as string]),
      }))
      const res = await this.client
        .table('productions')
        .multiInsert(chunk)
        .returning(['id', 'status', 'anta_published_at'])
      inserted.push(...(res as typeof inserted))
    }
    console.log(`✔ ${inserted.length} productions créées`)

    // 5. Auteurs de chaque production : pivot + colonne dénormalisée (Story 9.7).
    await this.client.transaction(async (trx) => {
      for (const production of inserted) {
        await ProductionAuthorService.sync(production.id, pickAuthorIds(authorIds), trx)
      }
    })
    console.log('✔ auteurs rattachés (pivot + productions.authors)')

    // 6. Vues / téléchargements des publiées, datés sur 540 j (Story 12.5 : fenêtre de 365 j).
    const now = DateTime.now()
    const stamp = (publishedAt: DateTime | null) => randomStatDate(publishedAt, now).toISO() // with offset: right whatever the Node timezone
    const published = inserted.filter((r) => r.status === 'published')
    const viewRows: { production_id: string; ip_hash: string; recorded_at: string | null }[] = []
    const downloadRows: { production_id: string; ip_hash: string; downloaded_at: string | null }[] =
      []
    for (const { id, anta_published_at: date } of published) {
      const publishedAt = date ? DateTime.fromJSDate(date) : null
      const views = randInt(0, 80)
      const downloads = randInt(0, 30)
      for (let v = 0; v < views; v++)
        viewRows.push({
          production_id: id,
          ip_hash: `seed-v-${id}-${v}`,
          recorded_at: stamp(publishedAt),
        })
      for (let d = 0; d < downloads; d++)
        downloadRows.push({
          production_id: id,
          ip_hash: `seed-d-${id}-${d}`,
          downloaded_at: stamp(publishedAt),
        })
    }
    const SCHUNK = 2000
    for (let c = 0; c < viewRows.length; c += SCHUNK) {
      await this.client.table('stats_views').multiInsert(viewRows.slice(c, c + SCHUNK))
    }
    for (let c = 0; c < downloadRows.length; c += SCHUNK) {
      await this.client.table('stats_downloads').multiInsert(downloadRows.slice(c, c + SCHUNK))
    }
    console.log(`✔ ${viewRows.length} vues + ${downloadRows.length} téléchargements générés`)
    console.log('✅ Seed démo terminé : 250 publiées, 30 dépubliées, 20 brouillons')
  }

  /** Creates the missing `seed-demo:<n>` cards; returns the ids of all of them. */
  private async seedAuthors(): Promise<string[]> {
    const ids: string[] = []
    for (let n = 1; n <= SEED_AUTHOR_COUNT; n++) {
      const migrationKey = `${SEED_AUTHOR_PREFIX}${n}`
      const existing = await Author.query({ client: this.client })
        .where('migration_key', migrationKey)
        .first()
      if (existing) {
        ids.push(existing.id)
        continue
      }
      const author = await Author.create(
        {
          firstNames: SEED_FIRST_NAMES[(n - 1) % SEED_FIRST_NAMES.length],
          lastNames: SEED_LAST_NAMES[Math.floor((n - 1) / SEED_FIRST_NAMES.length)],
          migrationKey,
          createdById: null,
        },
        { client: this.client }
      )
      const affiliations = n % 2 === 0 ? 2 : 1
      for (let position = 1; position <= affiliations; position++) {
        await AuthorAffiliation.create(
          {
            authorId: author.id,
            position,
            institution: SEED_INSTITUTIONS[(n + position) % SEED_INSTITUTIONS.length],
            department: SEED_DEPARTMENTS[(n + position) % SEED_DEPARTMENTS.length],
          },
          { client: this.client }
        )
      }
      // Un tiers à consentement confirmé (D27 : chaque fiche a au moins une affiliation).
      if (n % 3 === 0) {
        author.consentConfirmedAt = DateTime.now()
        await author.save()
      }
      ids.push(author.id)
    }
    return ids
  }
}
