import { useState } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { Eye, Download, ExternalLink } from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import ViewTracker from '~/components/public/ViewTracker'
import MediaViewer from '~/components/public/MediaViewer'
import { languageLabel } from '~/lib/languages'
import type { SeoMeta } from '~/lib/seo'

type ProductionFile = {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  url: string | null
  downloadUrl: string
}

type ProductionLink = {
  id: string
  url: string
  label: string | null
  linkType: 'embed' | 'simple'
}

export type ProductionDetail = {
  id: string
  slug: string
  title: string
  summary: string | null
  authors: string[]
  tags: string[]
  category: string | null
  domain: string | null
  subdomain: string[]
  language: string | null
  publicationCountry: string | null
  journal: string | null
  publisher: string | null
  isbnDoiIssn: string | null
  institution: string | null
  licenseStatus: 'member' | 'free_license' | 'external_link'
  workPublishedAt: string | null
  publishedAt: string | null
  viewsCount: number
  downloadsCount: number
  files: ProductionFile[]
  links: ProductionLink[]
}

type Props = {
  production: ProductionDetail
  meta?: SeoMeta
}

export default function ProductionShow({ production }: Props) {
  const { t, i18n } = useTranslation()
  // Compteurs optimistes : incrémentés sans rechargement (vue enregistrée après 10s ; clic téléchargement).
  const [downloadsCount, setDownloadsCount] = useState(production.downloadsCount)
  const [viewsCount, setViewsCount] = useState(production.viewsCount)

  const formatDate = (iso: string | null): string | null =>
    iso
      ? new Date(iso).toLocaleDateString(i18n.language, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : null

  const workDate = formatDate(production.workPublishedAt)

  // Ligne de métadonnée : rendue uniquement si la valeur est présente (AC1 — pas de label vide).
  const MetaRow = ({ label, value }: { label: string; value: string | null | undefined }) =>
    value && value.trim() !== '' ? (
      <div className="border-t border-stone-100 py-2 first:border-t-0">
        <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
        <dd className="mt-0.5 text-sm text-stone-900">{value}</dd>
      </div>
    ) : null

  return (
    <article>
      {/* Breadcrumb (AC4) */}
      <nav aria-label={t('production_detail.breadcrumb_label')} className="text-sm text-stone-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-green-700">
              {t('production_detail.breadcrumb_home')}
            </Link>
          </li>
          <li aria-hidden className="text-stone-300">
            /
          </li>
          <li>
            <Link href="/productions" className="hover:text-green-700">
              {t('production_detail.breadcrumb_productions')}
            </Link>
          </li>
          <li aria-hidden className="text-stone-300">
            /
          </li>
          <li aria-current="page" className="max-w-[20rem] truncate text-stone-700">
            {production.title}
          </li>
        </ol>
      </nav>

      <header className="mt-6">
        <h1 className="font-display text-3xl leading-tight text-stone-900">{production.title}</h1>
        {production.authors.length > 0 && (
          <p className="mt-2 text-stone-600">
            {t('production_card.by')} {production.authors.join(', ')}
          </p>
        )}
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Colonne principale (~2/3) : résumé + fichiers/liens (liste simple — lecteurs en 6.2/6.3) */}
        <div className="lg:col-span-2">
          {production.summary && (
            <section>
              <h2 className="text-xl text-stone-900">{t('production_detail.summary')}</h2>
              <p className="mt-3 whitespace-pre-line text-stone-700">{production.summary}</p>
            </section>
          )}

          {production.files.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl text-stone-900">{t('production_detail.files')}</h2>
              <div className="mt-3 space-y-4">
                {production.files.map((file) => (
                  <MediaViewer
                    key={file.id}
                    file={file}
                    onDownload={() => setDownloadsCount((n) => n + 1)}
                  />
                ))}
              </div>
            </section>
          )}

          {production.links.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl text-stone-900">{t('production_detail.external_links')}</h2>
              <div className="mt-3 space-y-4">
                {production.links.map((link) =>
                  link.linkType === 'embed' ? (
                    <iframe
                      key={link.id}
                      src={link.url}
                      title={link.label || t('production_detail.external_links')}
                      sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                      allow="fullscreen; encrypted-media; picture-in-picture"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="aspect-video w-full rounded-lg border border-stone-200"
                    />
                  ) : (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
                    >
                      <ExternalLink className="size-4" aria-hidden />
                      {link.label || t('media.access_source')}
                    </a>
                  )
                )}
              </div>
            </section>
          )}
        </div>

        {/* Aside (~1/3) : compteurs + métadonnées secondaires */}
        <aside className="lg:col-span-1">
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex items-center gap-6">
              <div
                className="flex items-center gap-2 text-stone-700"
                aria-label={t('production_card.views', { count: viewsCount })}
              >
                <Eye className="size-5 text-green-700" aria-hidden />
                <span className="text-lg font-semibold">{viewsCount}</span>
              </div>
              <div
                className="flex items-center gap-2 text-stone-700"
                aria-label={t('production_card.downloads', { count: downloadsCount })}
              >
                <Download className="size-5 text-green-700" aria-hidden />
                <span className="text-lg font-semibold">{downloadsCount}</span>
              </div>
            </div>

            <dl className="mt-4">
              <MetaRow label={t('production_detail.category')} value={production.category} />
              <MetaRow label={t('production_detail.domain')} value={production.domain} />
              {production.subdomain.length > 0 && (
                <div className="border-t border-stone-100 py-2">
                  <dt className="text-xs uppercase tracking-wide text-stone-500">
                    {t('production_detail.subdomain')}
                  </dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {production.subdomain.map((sd) => (
                      <Badge key={sd} variant="outline">
                        {sd}
                      </Badge>
                    ))}
                  </dd>
                </div>
              )}
              <MetaRow
                label={t('production_detail.language')}
                value={languageLabel(production.language)}
              />
              <MetaRow label={t('production_detail.country')} value={production.publicationCountry} />
              <MetaRow label={t('production_detail.work_published_at')} value={workDate} />
              <MetaRow
                label={t('production_detail.license_label')}
                value={t(`production_detail.license.${production.licenseStatus}`)}
              />
              <MetaRow label={t('production_detail.journal')} value={production.journal} />
              <MetaRow label={t('production_detail.publisher')} value={production.publisher} />
              <MetaRow label={t('production_detail.identifier')} value={production.isbnDoiIssn} />
              <MetaRow label={t('production_detail.institution')} value={production.institution} />
            </dl>

            {production.tags.length > 0 && (
              <div className="mt-4 border-t border-stone-100 pt-4">
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  {t('production_detail.tags')}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {production.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Enregistrement de vue après 10s (FR25) — incrément optimiste du compteur */}
      <ViewTracker productionId={production.id} onRecorded={() => setViewsCount((n) => n + 1)} />
    </article>
  )
}
