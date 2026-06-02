/**
 * Options de toast par type, dérivées d'UX-DR13.
 *
 * Module pur (zéro import `sonner`/DOM) afin d'être testable en environnement
 * Node/Japa. Importé par `notify.ts` (côté navigateur) et par les tests.
 *
 *  - success / info → auto-disparition après 3 s
 *  - error          → persistant (durée infinie) + bouton "Fermer"
 */
export type ToastType = 'success' | 'error' | 'info'

export type ToastOptions = {
  duration: number
  closeButton?: boolean
}

export function toastOptionsFor(type: ToastType): ToastOptions {
  if (type === 'error') {
    return { duration: Number.POSITIVE_INFINITY, closeButton: true }
  }
  // success | info
  return { duration: 3000 }
}
