import { Data } from '@generated/data'
import { ReactElement } from 'react'
import { useForm, usePage } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import AdminAuthLayout from '~/layouts/AdminAuthLayout'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

export default function AdminChangePassword() {
  const { t } = useTranslation()
  const { props } = usePage<Data.SharedProps>()
  const sharedErrors = props.errors as Record<string, string>

  const { data, setData, post, processing, errors } = useForm({
    password: '',
    password_confirmation: '',
  })

  const passwordError = errors.password ?? sharedErrors?.password
  const confirmationError =
    errors.password_confirmation ?? sharedErrors?.password_confirmation

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    post('/admin/auth/change-password', {
      preserveScroll: true,
      onFinish: () => {
        setData('password', '')
        setData('password_confirmation', '')
      },
    })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-stone-900">{t('auth.change_password.title')}</h1>
        <p className="text-sm text-stone-600">{t('auth.change_password.subtitle')}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-stone-700">
          {t('auth.change_password.fields.password')}
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={data.password}
          onChange={(e) => setData('password', e.target.value)}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? 'password-error' : 'password-hint'}
        />
        {passwordError ? (
          <p id="password-error" className="text-sm text-red-600">
            {t(passwordError, { defaultValue: passwordError })}
          </p>
        ) : (
          <p id="password-hint" className="text-xs text-stone-500">
            {t('auth.change_password.hint')}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password_confirmation"
          className="block text-sm font-medium text-stone-700"
        >
          {t('auth.change_password.fields.password_confirmation')}
        </label>
        <Input
          id="password_confirmation"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={data.password_confirmation}
          onChange={(e) => setData('password_confirmation', e.target.value)}
          aria-invalid={confirmationError ? true : undefined}
          aria-describedby={confirmationError ? 'confirmation-error' : undefined}
        />
        {confirmationError && (
          <p id="confirmation-error" className="text-sm text-red-600">
            {t(confirmationError, { defaultValue: confirmationError })}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={processing}
        className="w-full bg-green-700 hover:bg-green-800 text-white"
      >
        {processing ? t('auth.change_password.submitting') : t('auth.change_password.submit')}
      </Button>
    </form>
  )
}

AdminChangePassword.layout = (page: ReactElement) => <AdminAuthLayout>{page}</AdminAuthLayout>
