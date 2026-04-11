const AdminRole = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole]
export default AdminRole
