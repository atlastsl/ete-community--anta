import { useTranslation } from 'react-i18next'
import type { SeoMeta } from '~/lib/seo'

const SECTIONS = ['intro', 'data_collected', 'data_usage', 'data_retention', 'rights', 'contact'] as const

// `meta` est injecté côté serveur (rendu dans le <head> par l'edge), non utilisé ici.
export default function PrivacyPolicy(_props: { meta?: SeoMeta }) {
  const { t } = useTranslation()

  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-stone-900 mb-8">{t('privacy.title')}</h1>

      {SECTIONS.map((section) => (
        <section key={section} className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">
            {t(`privacy.${section}.heading`)}
          </h2>
          <p className="text-stone-700 leading-relaxed">{t(`privacy.${section}.body`)}</p>
        </section>
      ))}
    </article>
  )
}
