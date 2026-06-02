import { Data } from '@generated/data'
import { ReactElement } from 'react'
import { useForm, usePage } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import AdminAuthLayout from '~/layouts/AdminAuthLayout'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

export default function AdminLogin() {
  const { t } = useTranslation()
  const { props } = usePage<Data.SharedProps>()
  const flash = props.flash
  const sharedErrors = props.errors as Record<string, string>

  const { data, setData, post, processing, errors } = useForm({
    email: '',
    password: '',
  })

  const emailError = errors.email ?? sharedErrors?.email
  const passwordError = errors.password ?? sharedErrors?.password
  const globalError = flash?.error

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    post('/admin/login', {
      preserveScroll: true,
      onFinish: () => setData('password', ''),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-stone-900">{t('auth.login.title')}</h1>
        <p className="text-sm text-stone-600">{t('auth.login.subtitle')}</p>
      </div>

      {globalError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {t(globalError, { defaultValue: globalError })}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-stone-700">
          {t('auth.login.fields.email')}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={data.email}
          onChange={(e) => setData('email', e.target.value)}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'email-error' : undefined}
        />
        {emailError && (
          <p id="email-error" className="text-sm text-red-600">
            {t(emailError, { defaultValue: emailError })}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-stone-700">
          {t('auth.login.fields.password')}
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={data.password}
          onChange={(e) => setData('password', e.target.value)}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? 'password-error' : undefined}
        />
        {passwordError && (
          <p id="password-error" className="text-sm text-red-600">
            {t(passwordError, { defaultValue: passwordError })}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={processing}
        className="w-full bg-green-700 hover:bg-green-800 text-white"
      >
        {processing ? t('auth.login.submitting') : t('auth.login.submit')}
      </Button>
    </form>
  )
}

AdminLogin.layout = (page: ReactElement) => <AdminAuthLayout>{page}</AdminAuthLayout>
