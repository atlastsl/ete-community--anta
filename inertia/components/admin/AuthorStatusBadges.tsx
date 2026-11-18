import { useTranslation } from 'react-i18next'
import { Badge } from '~/components/ui/badge'

type Props = {
  /** `consent_confirmed_at` set (D19). */
  isPublic: boolean
  /** No affiliation: derived, never stored (P2-03). */
  isIncomplete: boolean
}

/**
 * Informative (non-interactive) status badges of an author card (Story 9.2, D32).
 * Reused by the edit page (9.4) and the author picker (9.7).
 */
export default function AuthorStatusBadges({ isPublic, isIncomplete }: Props) {
  const { t } = useTranslation()

  return (
    <span className="flex flex-wrap gap-1">
      {isPublic ? (
        <Badge variant="outline" className="border-green-600 text-green-700">
          {t('authors.badges.public')}
        </Badge>
      ) : (
        <Badge variant="secondary" className="bg-stone-100 text-stone-700">
          {t('authors.badges.not_public')}
        </Badge>
      )}
      {isIncomplete && (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
          {t('authors.badges.incomplete')}
        </Badge>
      )}
    </span>
  )
}
