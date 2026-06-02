import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import LicenseStatus from '#enums/license_status'
import LinkType from '#enums/link_type'

/**
 * Validateur d'enregistrement BROUILLON (Story 4.3).
 *
 * Seul `title` est requis (contrainte DB NOT NULL). Tous les autres champs sont
 * optionnels — un brouillon peut être incomplet (FR20). La validation de
 * complétude pour la PUBLICATION (FR21) est gérée séparément en Story 4.6.
 */
export const draftProductionValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255),
    summary: vine.string().trim().optional(),
    authors: vine.array(vine.string().trim()).optional(),
    tags: vine.array(vine.string().trim()).optional(),
    category: vine.string().trim().maxLength(255).optional(),
    domain: vine.string().trim().maxLength(255).optional(),
    subdomain: vine.array(vine.string().trim()).optional(),
    language: vine.string().trim().maxLength(255).optional(),
    publicationCountry: vine.string().trim().maxLength(255).optional(),
    journal: vine.string().trim().maxLength(255).optional(),
    publisher: vine.string().trim().maxLength(255).optional(),
    isbnDoiIssn: vine.string().trim().maxLength(255).optional(),
    institution: vine.string().trim().maxLength(255).optional(),
    licenseStatus: vine.enum(Object.values(LicenseStatus)).optional(),
    // Format date stricte `YYYY-MM-DD` (l'input HTML type=date l'émet ainsi). Évite
    // qu'un POST direct avec une string arbitraire produise un DateTime invalide.
    workPublishedAt: vine
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
)

draftProductionValidator.messagesProvider = new SimpleMessagesProvider({
  'title.required': 'productions.form.errors.title_required',
  'title.minLength': 'productions.form.errors.title_required',
  'title.maxLength': 'productions.form.errors.title_too_long',
})

/**
 * Validateur d'ajout de lien externe (Story 4.5).
 * URL complète http(s) requise, type embed/simple, label optionnel.
 */
export const createLinkValidator = vine.compile(
  vine.object({
    url: vine
      .string()
      .trim()
      .url({ require_protocol: true, protocols: ['http', 'https'] }),
    linkType: vine.enum(Object.values(LinkType)),
    label: vine.string().trim().maxLength(255).optional(),
  })
)

createLinkValidator.messagesProvider = new SimpleMessagesProvider({
  'url.required': 'productions.links.errors.invalid_url',
  'url.url': 'productions.links.errors.invalid_url',
})
