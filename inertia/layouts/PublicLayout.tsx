import { Data } from '@generated/data'
import { toast, Toaster } from 'sonner'
import { usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ReactElement, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '~/components/shared/LanguageSwitcher'

export default function PublicLayout({ children }: { children: ReactElement<Data.SharedProps> }) {
  const { props, url } = usePage<Data.SharedProps>()
  const flash = props.flash
  const { t } = useTranslation()

  useEffect(() => {
    toast.dismiss()
  }, [url])

  useEffect(() => {
    // Les flashs serveur sont des clés i18n (ex. `productions.download_unavailable`) → traduire
    // (defaultValue = la valeur brute si ce n'est pas une clé connue). Aligné sur AdminLayout.
    if (flash?.error) toast.error(t(flash.error, { defaultValue: flash.error }))
    if (flash?.success) toast.success(t(flash.success, { defaultValue: flash.success }))
  }, [flash?.error, flash?.success, t])

  return (
    <div className="min-h-screen flex flex-col bg-background text-stone-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-green-700 focus:px-4 focus:text-white"
      >
        {t('a11y.skip_to_content')}
      </a>
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center" aria-label="Anta — Accueil">
            <img src="/images/logo_anta.png" alt="Anta" className="h-10 w-auto" />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 outline-none"
      >
        {children}
      </main>

      <footer className="border-t border-stone-200 bg-stone-50 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-10 grid gap-8 sm:grid-cols-3">
          <div>
            <img src="/images/logo_anta.png" alt="Anta" className="h-8 w-auto" />
            <p className="mt-3 text-sm text-stone-600 max-w-xs">{t('footer.about')}</p>
          </div>

          <nav aria-label={t('footer.nav_label')}>
            <h2 className="text-sm font-semibold text-stone-900">{t('footer.explore')}</h2>
            <ul className="mt-3 space-y-2 text-sm text-stone-600">
              <li>
                <Link href="/" className="hover:text-green-700">{t('nav.home')}</Link>
              </li>
              <li>
                <Link href="/productions" className="hover:text-green-700">{t('nav.search')}</Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-green-700">
                  {t('nav.privacy_policy')}
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold text-stone-900">{t('footer.contact')}</h2>
            <p className="mt-3 text-sm text-stone-600">
              <a href="mailto:contact@anta.community" className="hover:text-green-700">
                contact@anta.community
              </a>
            </p>
          </div>
        </div>
        <div className="border-t border-stone-200">
          <div className="max-w-7xl mx-auto px-6 py-4 text-sm text-stone-600">
            {t('footer.copyright')}
          </div>
        </div>
      </footer>

      <Toaster position="top-center" richColors />
    </div>
  )
}
