const ActionType = {
  LOGIN: 'login',
  CREATE: 'create',
  UPDATE: 'update',
  PUBLISH: 'publish',
  UNPUBLISH: 'unpublish',
  DELETE: 'delete',
  PASSWORD_RESET: 'password_reset',
  CONSENT_CONFIRM: 'consent_confirm',
  CONSENT_WITHDRAW: 'consent_withdraw',
} as const

export type ActionType = (typeof ActionType)[keyof typeof ActionType]
export default ActionType
