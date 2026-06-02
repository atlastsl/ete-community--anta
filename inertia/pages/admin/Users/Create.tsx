import { ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import AdminLayout from '~/layouts/AdminLayout'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

export default function AdminUsersCreate() {
  const { t } = useTranslation()
  const { data, setData, post, processing, errors } = useForm({ email: '' })
  const [clientError, setClientError] = useState<string | null>(null)

  function validateEmail(value: string): string | null {
    if (!value.trim()) return t('users.errors.email_required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return t('users.errors.email_invalid')
    return null
  }

  function handleBlur() {
    setClientError(validateEmail(data.email))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateEmail(data.email)
    if (err) {
      setClientError(err)
      return
    }
    setClientError(null)
    post('/admin/users')
  }

  const emailError = errors.email ? t(errors.email, { defaultValue: errors.email }) : clientError

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold text-stone-900">{t('users.create_title')}</h1>
      <p className="mt-2 text-sm text-stone-500">{t('users.form.help')}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-stone-700">
            {t('users.form.email')}
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="off"
            placeholder={t('users.form.email_placeholder')}
            value={data.email}
            onChange={(e) => {
              setData('email', e.target.value)
              if (clientError) setClientError(null)
            }}
            onBlur={handleBlur}
            aria-describedby={emailError ? 'email-error' : undefined}
            aria-invalid={!!emailError}
            className="mt-1"
          />
          {emailError && (
            <p id="email-error" className="mt-1 text-sm text-red-600">
              {emailError}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={processing}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            {processing && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('users.form.submit')}
          </Button>
          <Link href="/admin/users">
            <Button type="button" variant="outline">
              {t('actions.cancel')}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}

AdminUsersCreate.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
