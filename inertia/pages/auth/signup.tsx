import { Form } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'

export default function Signup() {
  const { t } = useTranslation('public')

  return (
    <div className="form-container">
      <div>
        <h1>{t('auth.signup.title')}</h1>
        <p>{t('auth.signup.subtitle')}</p>
      </div>

      <div>
        <Form route="new_account.store">
          {({ errors }) => (
            <>
              <div>
                <label htmlFor="fullName">{t('auth.signup.fullName')}</label>
                <input
                  type="text"
                  name="fullName"
                  id="fullName"
                  data-invalid={errors.fullName ? 'true' : undefined}
                />
                {errors.fullName && <div>{errors.fullName}</div>}
              </div>

              <div>
                <label htmlFor="email">{t('auth.signup.email')}</label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  autoComplete="email"
                  data-invalid={errors.email ? 'true' : undefined}
                />
                {errors.email && <div>{errors.email}</div>}
              </div>

              <div>
                <label htmlFor="password">{t('auth.signup.password')}</label>
                <input
                  type="password"
                  name="password"
                  id="password"
                  autoComplete="new-password"
                  data-invalid={errors.password ? 'true' : undefined}
                />
                {errors.password && <div>{errors.password}</div>}
              </div>

              <div>
                <label htmlFor="passwordConfirmation">
                  {t('auth.signup.passwordConfirmation')}
                </label>
                <input
                  type="password"
                  name="passwordConfirmation"
                  id="passwordConfirmation"
                  autoComplete="new-password"
                  data-invalid={errors.passwordConfirmation ? 'true' : undefined}
                />
                {errors.passwordConfirmation && <div>{errors.passwordConfirmation}</div>}
              </div>

              <div>
                <button type="submit" className="button">
                  {t('auth.signup.submit')}
                </button>
              </div>
            </>
          )}
        </Form>
      </div>
    </div>
  )
}
