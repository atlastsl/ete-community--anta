import type { KeyboardEvent } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { cn } from '~/lib/utils'
import { spaceToggle } from '~/lib/keyboard'

type FilterChipProps = {
  label: string
  href: string
  active?: boolean
  /** Bascule sur la même page (listing) : garder l'état et le défilement (10.6). */
  preserveState?: boolean
}

export default function FilterChip({
  label,
  href,
  active = false,
  preserveState = false,
}: FilterChipProps) {
  const { t } = useTranslation()

  // Filtre = lien de navigation (l'URL est la source de vérité). On expose l'état actif
  // via `aria-pressed` (bouton bascule) plutôt qu'une sémantique de case à cocher : le chip
  // NAVIGUE, il ne coche pas un état de formulaire — annoncer « case à cocher » induirait
  // l'AT en erreur. Entrée navigue (lien natif) ; Espace simple déclenche aussi la bascule
  // (une seule visite si la touche est maintenue ; modificateurs laissés au navigateur).
  // `role="button"` : `aria-pressed` n'est pas permis sur un lien nu (axe `aria-allowed-attr`,
  // Story 13.1).
  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    const action = spaceToggle(event)
    if (!action) return
    event.preventDefault()
    if (action === 'visit') router.visit(href, { preserveState, preserveScroll: preserveState })
  }

  return (
    <Link
      href={href}
      role="button"
      aria-pressed={active}
      aria-label={t('filters.filter_by', { label })}
      onKeyDown={handleKeyDown}
      preserveState={preserveState}
      preserveScroll={preserveState}
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
