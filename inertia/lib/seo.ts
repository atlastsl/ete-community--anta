/**
 * Forme des meta tags SEO partagés serveur → client.
 *
 * Le contrôleur passe `meta` en prop Inertia (construit par `SeoService` côté serveur) ;
 * il est rendu dans le `<head>` par `inertia_layout.edge` (SSR partiel — FR36). Les pages
 * React ne l'utilisent pas directement, mais le déclarent dans leurs props pour satisfaire
 * le typage `InertiaPages`.
 */
export type SeoMeta = {
  title: string
  description: string
  ogTitle: string
  ogDescription: string
  ogType: string
  ogUrl?: string
  locale: 'fr' | 'en'
}

/**
 * Document title of a public page (Story 10.4): the server title (`meta.title`, already
 * suffixed « — Anta ») escaped for Inertia's head manager, which inserts it as HTML; `''`
 * without meta (the entry's default title then applies).
 */
export function documentTitle(title: string | null | undefined): string {
  return (title ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
}
