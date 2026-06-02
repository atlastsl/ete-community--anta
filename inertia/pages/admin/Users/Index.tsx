import { ReactElement, useState } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import AdminLayout from '~/layouts/AdminLayout'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '~/components/ui/dialog'
import { cn } from '~/lib/utils'

type UserRow = {
  id: string
  email: string
  role: 'admin' | 'super_admin'
  isActive: boolean
  createdAt: string | null
  createdBy: string | null
}

export default function AdminUsersIndex({ users }: { users: UserRow[] }) {
  const { t, i18n } = useTranslation()
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const visitOptions = {
    preserveScroll: true,
    onStart: () => setIsProcessing(true),
    onFinish: () => setIsProcessing(false),
  }

  function handleToggleActive(userId: string) {
    router.patch(`/admin/users/${userId}/toggle-active`, {}, visitOptions)
  }

  function handleConfirmDeactivate() {
    if (deactivateTarget) {
      handleToggleActive(deactivateTarget.id)
      setDeactivateTarget(null)
    }
  }

  function handleConfirmReset() {
    if (resetTarget) {
      router.post(`/admin/users/${resetTarget.id}/reset-password`, {}, visitOptions)
      setResetTarget(null)
    }
  }

  function handleConfirmDelete() {
    if (deleteTarget) {
      router.delete(`/admin/users/${deleteTarget.id}`, visitOptions)
      setDeleteTarget(null)
    }
  }

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—'

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">{t('users.title')}</h1>
        <Link href="/admin/users/create">
          <Button className="bg-green-700 hover:bg-green-800 text-white">
            {t('users.create_button')}
          </Button>
        </Link>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="size-12 text-stone-300" aria-hidden />
          <p className="mt-4 text-lg font-medium text-stone-700">{t('users.empty_title')}</p>
          <p className="mt-1 text-sm text-stone-500">{t('users.empty_description')}</p>
          <Link href="/admin/users/create">
            <Button className="mt-6 bg-green-700 hover:bg-green-800 text-white">
              {t('users.create_button')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-600">
                <th className="px-4 py-3 font-medium">{t('users.table.email')}</th>
                <th className="px-4 py-3 font-medium">{t('users.table.role')}</th>
                <th className="px-4 py-3 font-medium">{t('users.table.status')}</th>
                <th className="px-4 py-3 font-medium">{t('users.table.created_at')}</th>
                <th className="px-4 py-3 font-medium">{t('users.table.created_by')}</th>
                <th className="px-4 py-3 font-medium">{t('users.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={cn(
                    'border-b border-stone-100 last:border-0',
                    !user.isActive && 'opacity-60'
                  )}
                >
                  <td className="px-4 py-3 font-medium text-stone-900">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.role === 'super_admin' ? (
                      <Badge className="bg-green-700 text-white hover:bg-green-700">
                        {t('role.super_admin')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t('role.admin')}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <Badge variant="outline" className="border-green-600 text-green-700">
                        {t('users.status.active')}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">{t('users.status.inactive')}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3 text-stone-600">{user.createdBy ?? '—'}</td>
                  <td className="px-4 py-3">
                    {/* Les comptes super_admin ne sont pas gérables depuis cette interface (FR34) */}
                    {user.role === 'super_admin' ? (
                      <span className="text-stone-400">—</span>
                    ) : (
                      <div className="flex gap-2">
                        {user.isActive ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => setDeactivateTarget(user)}
                          >
                            {t('users.deactivate_button')}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleToggleActive(user.id)}
                          >
                            {t('users.reactivate_button')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => setResetTarget(user)}
                        >
                          {t('users.reset_password_button')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isProcessing}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteTarget(user)}
                        >
                          {t('users.delete_button')}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>{t('users.deactivate_modal.title')}</DialogTitle>
            <DialogDescription>{t('users.deactivate_modal.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('actions.cancel')}</Button>
            </DialogClose>
            <Button variant="destructive" disabled={isProcessing} onClick={handleConfirmDeactivate}>
              {t('users.deactivate_modal.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>{t('users.reset_password_modal.title')}</DialogTitle>
            <DialogDescription>{t('users.reset_password_modal.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('actions.cancel')}</Button>
            </DialogClose>
            <Button
              className="bg-green-700 hover:bg-green-800 text-white"
              disabled={isProcessing}
              onClick={handleConfirmReset}
            >
              {t('users.reset_password_modal.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>{t('users.delete_modal.title')}</DialogTitle>
            <DialogDescription>{t('users.delete_modal.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('actions.cancel')}</Button>
            </DialogClose>
            <Button variant="destructive" disabled={isProcessing} onClick={handleConfirmDelete}>
              {t('users.delete_modal.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

AdminUsersIndex.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
