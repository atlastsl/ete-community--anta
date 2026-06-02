import type { KeyboardEvent } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { cn } from '~/lib/utils'

type FilterChipProps = {
  label: string
  href: string
  active?: boolean
}

export default function FilterChip({ label, href, active = false }: FilterChipProps) {
  const { t } = useTranslation()

  // Filtre = lien de navigation (l'URL est la source de vérité). On expose l'état actif
  // via `aria-pressed` (bouton bascule) plutôt qu'une sémantique de case à cocher : le chip
  // NAVIGUE, il ne coche pas un état de formulaire — annoncer « case à cocher » induirait
  // l'AT en erreur. Entrée navigue (lien natif) ; Espace déclenche aussi la bascule.
  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key === ' ') {
      event.preventDefault()
      router.visit(href)
    }
  }

  return (
    <Link
      href={href}
      aria-pressed={active}
      aria-label={t('filters.filter_by', { label })}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex min-h-11 snap-start items-center whitespace-nowrap rounded-full px-4 text-sm',
        active
          ? 'bg-green-700 text-white'
          : 'border border-stone-300 text-stone-700 hover:border-green-700 hover:text-green-700'
      )}
    >
      {label}
    </Link>
  )
}
