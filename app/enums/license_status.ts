const LicenseStatus = {
  MEMBER: 'member',
  FREE_LICENSE: 'free_license',
  EXTERNAL_LINK: 'external_link',
} as const

export type LicenseStatus = (typeof LicenseStatus)[keyof typeof LicenseStatus]
export default LicenseStatus
