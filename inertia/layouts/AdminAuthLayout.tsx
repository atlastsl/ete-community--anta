import { Data } from '@generated/data'
import { ReactNode, useEffect } from 'react'
import { Head, usePage } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { toast, Toaster } from 'sonner'

export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  const { props, url } = usePage<Data.SharedProps>()
  const { t } = useTranslation()
  const flash = props.flash

  useEffect(() => {
    toast.dismiss()
  }, [url])

  useEffect(() => {
    if (flash?.success) toast.success(t(flash.success, { defaultValue: flash.success }))
    if (flash?.error) toast.error(t(flash.error, { defaultValue: flash.error }))
  }, [flash?.success, flash?.error, t])

  return (
    <>
      {/* FR37 — Pages d'auth admin exclues de l'indexation */}
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <img src="/images/logo_anta.png" alt="Anta" className="h-10 w-auto" />
          </div>
          <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
            {children}
          </div>
        </div>
        <Toaster position="top-center" richColors />
      </div>
    </>
  )
}
