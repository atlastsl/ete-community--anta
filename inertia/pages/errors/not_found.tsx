import { useTranslation } from 'react-i18next'
import type { SeoMeta } from '~/lib/seo'

const LINK_BASE =
  'inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2'

/**
 * NotFoundPage traduite (D36, Story 10.1) : rendue avec le statut 404 par le gestionnaire
 * d'exceptions (URL inconnue) et par les contrôleurs publics (production ou profil non visible).
 * `meta` (titre traduit) est injecté côté serveur dans le <head> par l'edge, non utilisé ici.
 * Liens `<a href>` (chargement complet), pas le composant Link d'Inertia : la page est aussi rendue par le
 * bundle admin (URL `/admin/*` inconnue, sans PublicLayout ni locales publiques) dont le titre
 * ne suivrait pas une navigation SPA (le <Head> de titre est celui de PublicLayout, Story 10.4).
 */
export default function NotFound(_props: { meta?: SeoMeta }) {
  const { t } = useTranslation()

  return (
    <section className="mx-auto max-w-3xl py-12 text-center sm:py-20">
      <p className="text-sm font-semibold uppercase tracking-wide text-green-700">404</p>
      <h1 className="mt-3 text-3xl leading-tight text-stone-900">{t('not_found.title')}</h1>
      <p className="mt-4 text-base text-stone-600">{t('not_found.message')}</p>

      <nav aria-label={t('not_found.nav_label')} className="mt-8">
        <ul className="flex flex-wrap items-center justify-center gap-3">
          <li>
            <a
              href="/"
              className={`${LINK_BASE} bg-green-700 text-white hover:bg-green-800`}
            >
              {t('not_found.home')}
            </a>
          </li>
          <li>
            <a
              href="/productions"
              className={`${LINK_BASE} border border-stone-300 bg-white text-stone-900 hover:border-green-700 hover:text-green-700`}
            >
              {t('not_found.search')}
            </a>
          </li>
        </ul>
      </nav>
    </section>
  )
}
