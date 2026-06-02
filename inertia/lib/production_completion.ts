/**
 * Règle d'attachement requise pour publier une production (FR21, AC5 Story 4.5).
 *
 * - licence `external_link` (contenu sous copyright) : au moins un LIEN est requis
 *   — un fichier hébergé seul ne suffit pas.
 * - licence `member` / `free_license` : au moins un fichier OU un lien.
 *
 * Fonction pure, réutilisée par `CompletionIndicator`, le bouton « Publier » et
 * (Story 4.6) la validation serveur de publication.
 */
export type ProductionLicenseStatus = 'member' | 'free_license' | 'external_link'

export function isAttachmentSatisfied(
  licenseStatus: ProductionLicenseStatus,
  hasFile: boolean,
  hasLink: boolean
): boolean {
  if (licenseStatus === 'external_link') return hasLink
  return hasFile || hasLink
}
