import { toast } from 'sonner'
import { toastOptionsFor } from '~/lib/notify_options'

/**
 * Helper de notification centralisé (UX-DR13).
 *
 * Point d'entrée unique pour tous les toasts du panel admin : garantit des
 * durées, couleurs et comportements cohérents (succès vert 3 s, erreur rouge
 * persistante + bouton Fermer, info neutre 3 s).
 *
 * Le `<Toaster>` (AdminLayout) fournit position bas-droite, richColors et la
 * limite de 3 toasts simultanés.
 */
export const notify = {
  success: (message: string) => toast.success(message, toastOptionsFor('success')),
  error: (message: string) => toast.error(message, toastOptionsFor('error')),
  info: (message: string) => toast(message, toastOptionsFor('info')),
}
