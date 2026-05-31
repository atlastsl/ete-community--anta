import { Link } from '@inertiajs/react'
import { Toaster } from 'sonner'
import { ReactElement } from 'react'

export default function AdminLayout({ children }: { children: ReactElement }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link
            href="/admin/productions"
            className="flex items-center"
            aria-label="Anta Admin"
          >
            <img src="/images/logo_anta.png" alt="Anta" className="h-8 w-auto" />
            <span className="ml-3 text-sm font-medium text-stone-600">Admin</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">{children}</main>

      <Toaster position="top-center" richColors />
    </div>
  )
}
