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
  locale: 'fr' | 'en'
}
