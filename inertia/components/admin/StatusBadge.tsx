import { useTranslation } from 'react-i18next'
import { Badge } from '~/components/ui/badge'

type ProductionStatus = 'draft' | 'published' | 'unpublished'

const STATUS_CONFIG: Record<
  ProductionStatus,
  { variant: 'secondary' | 'outline'; className?: string }
> = {
  draft: { variant: 'secondary' },
  published: {
    variant: 'outline',
    className: 'border-green-600 text-green-700',
  },
  unpublished: { variant: 'outline', className: 'border-amber-700 text-amber-800' },
}

export default function StatusBadge({ status }: { status: ProductionStatus }) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[status]

  return (
    <Badge variant={config.variant} className={config.className}>
      {t(`productions.status.${status}`)}
    </Badge>
  )
}
