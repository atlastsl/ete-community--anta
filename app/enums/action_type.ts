const ActionType = {
  LOGIN: 'login',
  CREATE: 'create',
  UPDATE: 'update',
  PUBLISH: 'publish',
  UNPUBLISH: 'unpublish',
  DELETE: 'delete',
  PASSWORD_RESET: 'password_reset',
} as const

export type ActionType = (typeof ActionType)[keyof typeof ActionType]
export default ActionType
