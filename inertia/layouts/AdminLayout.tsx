import { Data } from '@generated/data'
import { Head, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { toast, Toaster } from 'sonner'
import { ReactElement, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, FolderOpen, LogOut, Users } from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import { notify } from '~/lib/notify'
import { cn } from '~/lib/utils'

type NavItem = {
  labelKey: string
  href: string
  icon: typeof FolderOpen
  superAdminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.productions', href: '/admin/productions', icon: FolderOpen },
  { labelKey: 'nav.statistics', href: '/admin/stats', icon: BarChart3 },
  { labelKey: 'nav.users', href: '/admin/users', icon: Users, superAdminOnly: true },
]

export default function AdminLayout({ children }: { children: ReactElement }) {
  const { props, url } = usePage<Data.SharedProps>()
  const { t } = useTranslation()
  const user = props.user
  const flash = props.flash
  const isSuperAdmin = user?.role === 'super_admin'

  useEffect(() => {
    toast.dismiss()
  }, [url])

  useEffect(() => {
    if (flash?.error) notify.error(t(flash.error, { defaultValue: flash.error }))
    if (flash?.success) notify.success(t(flash.success, { defaultValue: flash.success }))
    // Échec d'envoi d'email : on affiche le mot de passe provisoire dans un toast
    // persistant (avertissement ambre) pour que le super admin puisse le transmettre.
    if (flash?.tempPassword) {
      toast.warning(`${t('users.temp_password_label')} : ${flash.tempPassword}`, {
        duration: Infinity,
        closeButton: true,
      })
    }
  }, [flash?.error, flash?.success, flash?.tempPassword, t])

  const visibleItems = NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin)

  return (
    <>
      {/* FR37 — Panel admin exclu de l'indexation des moteurs de recherche */}
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Mobile / tablette < lg — message d'avertissement */}
      <div className="lg:hidden min-h-screen flex items-center justify-center bg-stone-50 px-4 py-12">
        <p className="text-center text-stone-700">{t('layout.mobile_warning')}</p>
      </div>

      {/* Desktop ≥ lg */}
      <div className="hidden lg:flex min-h-screen bg-background text-stone-900">
        <aside className="w-64 shrink-0 border-r border-stone-200 bg-white flex flex-col">
          <div className="px-6 py-5 border-b border-stone-200">
            <Link href="/admin/productions" aria-label="Anta Admin" className="inline-flex">
              <img src="/images/logo_anta.png" alt="Anta" className="h-8 w-auto" />
            </Link>
          </div>

          <nav className="flex-1 py-4" aria-label="Navigation principale">
            <ul className="space-y-0.5">
              {visibleItems.map((item) => {
                const Icon = item.icon
                const active = url.startsWith(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-6 py-2.5 text-sm border-l-[3px] transition-colors',
                        active
                          ? 'bg-green-100 text-green-700 border-green-700 font-medium'
                          : 'text-stone-700 border-transparent hover:bg-stone-50'
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon className="size-4" aria-hidden />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {user && (
            <div className="border-t border-stone-200 px-6 py-4 space-y-3">
              {isSuperAdmin ? (
                <Badge className="bg-green-700 text-white hover:bg-green-700">
                  {t('role.super_admin')}
                </Badge>
              ) : (
                <Badge variant="secondary">{t('role.admin')}</Badge>
              )}
              <p className="text-sm text-stone-600 break-all">{user.email}</p>
              <Link
                href="/admin/logout"
                method="post"
                as="button"
                className="inline-flex items-center gap-2 text-sm text-stone-700 hover:text-stone-900"
              >
                <LogOut className="size-4" aria-hidden />
                <span>{t('nav.logout')}</span>
              </Link>
            </div>
          )}
        </aside>

        <main className="flex-1 px-8 py-8">{children}</main>

        <Toaster position="bottom-right" richColors closeButton visibleToasts={3} />
      </div>
    </>
  )
}
