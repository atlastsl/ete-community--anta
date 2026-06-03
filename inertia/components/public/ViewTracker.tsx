import { useEffect, useRef } from 'react'

/**
 * ViewTracker — composant invisible monté sur la page détail (FR25, UX-DR10).
 *
 * Démarre un timer de 10s au montage ; si le visiteur reste, POST /stats/view enregistre
 * une vue. Le timer est nettoyé au démontage (navigation/fermeture < 10s → aucune vue).
 * Échec silencieux : aucune UI d'erreur, aucune interruption.
 *
 * `onRecorded` est stocké dans un ref : le timer ne dépend que de `productionId` (stable),
 * donc un re-render du parent ne réinitialise pas le décompte de 10s.
 */
export default function ViewTracker({
  productionId,
  onRecorded,
}: {
  productionId: string
  onRecorded?: () => void
}) {
  const onRecordedRef = useRef(onRecorded)
  onRecordedRef.current = onRecorded

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch('/stats/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ productionId }),
      })
        .then((res) => {
          if (res.ok) onRecordedRef.current?.()
        })
        .catch(() => {
          // échec silencieux — ne jamais interrompre la navigation
        })
    }, 10_000)

    return () => clearTimeout(timer)
  }, [productionId])

  return null
}
