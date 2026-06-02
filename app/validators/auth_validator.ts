import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validator pour le login admin.
 *
 * Délibérément minimaliste : on exige email + password non vides.
 * Aucune contrainte de longueur min sur le password (cf. Story 2.2 Dev Notes —
 * sinon on révèle la politique de mot de passe aux attaquants via 422).
 *
 * Les vérifications métier (compte existant, mot de passe correct, isActive)
 * sont faites dans le contrôleur via `AdminUser.verifyCredentials` + checks.
 */
export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().maxLength(254),
    password: vine.string().minLength(1),
  })
)

/**
 * Mappe les codes d'erreur VineJS vers les clés i18n du login.
 * Résolues côté client via `t(errors.email)` / `t(errors.password)` (cf. Story 2.2 AC6).
 * Sans ce provider, un user FR verrait les messages par défaut VineJS en anglais brut.
 */
loginValidator.messagesProvider = new SimpleMessagesProvider({
  'email.required': 'auth.login.errors.email_required',
  'email.email': 'auth.login.errors.email_format',
  'email.maxLength': 'auth.login.errors.email_format',
  'password.required': 'auth.login.errors.password_required',
  'password.minLength': 'auth.login.errors.password_required',
})

/**
 * Validator pour le changement de mot de passe (Story 2.3 — première connexion).
 *
 * Règles MVP :
 *  - 12 caractères minimum (255 max — borne de sécurité)
 *  - confirmation identique via `password_confirmation` (convention VineJS .confirmed())
 *
 * Pas de contrainte de complexité (chiffres, majuscules, etc.) — out of scope MVP.
 * Pas d'historique des mots de passe — out of scope MVP.
 */
export const changePasswordValidator = vine.compile(
  vine.object({
    password: vine
      .string()
      .minLength(12)
      .maxLength(255)
      .confirmed({ confirmationField: 'password_confirmation' }),
  })
)

/**
 * Mappe les codes d'erreur VineJS vers les clés i18n attendues par le front.
 * Les clés sont résolues côté client via `t(errors.password)` (cf. pattern Story 2.2).
 */
changePasswordValidator.messagesProvider = new SimpleMessagesProvider({
  'password.required': 'auth.change_password.errors.password_required',
  'password.minLength': 'auth.change_password.errors.password_too_short',
  'password.maxLength': 'auth.change_password.errors.password_too_long',
  // VineJS `.confirmed()` reporte l'erreur sur le champ de confirmation, pas sur le principal
  'password_confirmation.confirmed': 'auth.change_password.errors.confirmation_mismatch',
})
