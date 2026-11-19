type KeyLike = {
  key: string
  repeat?: boolean
  shiftKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}

/**
 * Espace sur un filtre rendu comme lien (`FilterChip`, lignes du panneau de filtres, 10.6) :
 * - `null` : autre touche, ou Espace avec un modificateur (Maj, Ctrl, Alt, Méta gardent leur
 *   rôle pour le navigateur et les aides techniques) → ne rien faire ;
 * - `'swallow'` : Espace maintenue (répétition) → empêcher le défilement, sans nouvelle visite ;
 * - `'visit'` : Espace simple → basculer le filtre (une seule visite).
 */
export function spaceToggle(event: KeyLike): 'visit' | 'swallow' | null {
  if (event.key !== ' ') return null
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return null
  return event.repeat ? 'swallow' : 'visit'
}
