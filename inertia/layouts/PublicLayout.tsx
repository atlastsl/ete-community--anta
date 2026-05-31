import { Data } from '@generated/data'
import { toast, Toaster } from 'sonner'
import { Link, usePage } from '@inertiajs/react'
import { ReactElement, useEffect } from 'react'

export default function PublicLayout({ children }: { children: ReactElement<Data.SharedProps> }) {
  const { props, url } = usePage<Data.SharedProps>()
  const flash = props.flash

  useEffect(() => {
    toast.dismiss()
  }, [url])

  useEffect(() => {
    if (flash?.error) toast.error(flash.error)
    if (flash?.success) toast.success(flash.success)
  }, [flash?.error, flash?.success])

  return (
    <div className="min-h-screen flex flex-col bg-background text-stone-900">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center" aria-label="Anta — Accueil">
            <img src="/images/logo_anta.png" alt="Anta" className="h-10 w-auto" />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">{children}</main>

      <footer className="border-t border-stone-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-stone-600">© Anta</div>
      </footer>

      <Toaster position="top-center" richColors />
    </div>
  )
}
