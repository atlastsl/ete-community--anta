# Story 1.7 : Design system — Tailwind CSS v4 + shadcn/ui

Status: review

## Story

En tant que développeur,
Je veux Tailwind CSS v4 configuré avec les tokens de design et shadcn/ui installé,
Afin que tous les composants utilisent une palette cohérente, une typographie unifiée et des composants de base prêts à l'emploi (UX-DR15).

## Acceptance Criteria

**AC1** — Tailwind v4 installé et configuré

- **Given** Tailwind CSS v4 et le plugin Vite officiel sont installés
- **When** la commande `npm run dev` est lancée
- **Then** Tailwind compile sans erreur et les classes utilitaires (ex. `text-green-700`, `bg-stone-50`) sont appliquables dans les composants React et les templates Edge

**AC2** — Tokens de design Anta disponibles via CSS variables

- **Given** le bloc `@theme` est défini dans `inertia/css/app.css`
- **When** un composant utilise les classes Tailwind ou les variables CSS directement
- **Then** les tokens suivants sont disponibles :
  - `--color-primary` (green-700 — oklch équivalent à `#15803d`)
  - `--color-accent` (amber-900 — oklch équivalent à `#78350f`)
  - `--color-background` (stone-50 — oklch équivalent à `#fafaf9`)
  - `--color-text-secondary` (stone-600)
- **And** un commentaire CSS au-dessus du bloc `@theme` documente explicitement que amber-900 (brun chocolat) peut être utilisé EN TEXTE ET EN FOND décoratif sur fond clair (ratio 8.1:1, AAA conforme WCAG)

**AC3** — Typographies Playfair Display + Inter chargées

- **Given** les Google Fonts sont configurées
- **When** l'application charge
- **Then** Playfair Display est la font-family appliquée aux balises `h1` et `h2` (via `@layer base` dans le CSS Tailwind)
- **And** Inter est la font-family appliquée au `body`
- **And** les polices sont chargées via Google Fonts avec le paramètre `display=swap` dans `inertia_layout.edge`
- **And** `<link rel="preconnect">` vers `https://fonts.googleapis.com` et `https://fonts.gstatic.com` est présent pour optimiser le chargement

**AC4** — shadcn/ui initialisé et 5 composants de base installés

- **Given** shadcn/ui est initialisé via `npx shadcn@latest init` avec la palette Anta
- **When** on inspecte le projet
- **Then** `components.json` existe à la racine, configuré pour : style `default` (ou `new-york`), base color compatible Anta (palette stone), alias pointant vers `~/components/ui` et `~/lib/utils`
- **And** les composants suivants sont générés dans `inertia/components/ui/` : `button.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `badge.tsx`
- **And** `inertia/lib/utils.ts` contient le helper `cn()` (clsx + tailwind-merge)

**AC5** — Logo et favicon Anta intégrés

- **Given** `_docs/logo_anta_512.png` existe dans le dépôt
- **When** le setup est effectué
- **Then** le fichier est copié vers `public/images/logo_anta.png`
- **And** `public/favicon.png` existe (copie du même fichier ou variante adaptée)
- **And** `<link rel="icon" href="/favicon.png">` est présent dans `inertia_layout.edge`
- **And** `<html lang="fr">` (langue par défaut Anta)
- **And** le logo est rendu dans `PublicLayout.tsx` via `<img src="/images/logo_anta.png" alt="Anta" className="h-10 w-auto" />` lié à `/`
- **And** le logo est rendu dans `AdminLayout.tsx` via `<img src="/images/logo_anta.png" alt="Anta" className="h-8 w-auto" />` lié à `/admin/productions`

**AC6** — Layouts minimalistes en place

- **Given** `PublicLayout.tsx` et `AdminLayout.tsx` sont créés
- **When** un développeur ouvre la page d'accueil publique et n'importe quelle future page admin
- **Then** le layout public affiche : header sticky avec logo (h-10) + slot principal + footer minimaliste
- **And** le layout admin affiche : header avec logo (h-8) + slot principal (sans sidebar — viendra en Story 2.1)
- **And** `app.tsx` utilise `PublicLayout` au lieu de l'ancien `default.tsx`
- **And** l'ancien fichier `inertia/layouts/default.tsx` est supprimé
- **And** les pages legacy AdonisJS auth (`home.tsx`, `auth/login.tsx`, `auth/signup.tsx`) continuent de se rendre sans erreur runtime (visuellement non finalisées — c'est OK, elles seront refait dans Epic 2)

**AC7** — Validation visuelle au démarrage

- **Given** `npm run dev` est lancé
- **When** le développeur charge `http://localhost:3333` dans son navigateur
- **Then** le logo Anta apparaît dans le header
- **And** la favicon est visible dans l'onglet du navigateur
- **And** les polices Playfair Display et Inter sont effectivement chargées (vérifiable via DevTools Network)
- **And** aucune erreur Tailwind n'apparaît dans la console

## Tasks / Subtasks

- [x] **Tâche 1 — Installation Tailwind CSS v4** (AC1, AC2)
  - [x] 1.1 `npm install tailwindcss @tailwindcss/vite` — installé (12 packages)
  - [x] 1.2 Plugin `tailwindcss()` ajouté dans `vite.config.ts` (en tête de la liste plugins)
  - [x] 1.3 `inertia/css/app.css` réécrit complètement avec `@import "tailwindcss"`, `@theme` et `@layer base`

- [x] **Tâche 2 — Tokens de design dans `@theme`** (AC2)
  - [x] 2.1 4 variables définies en oklch (primary, accent, background, text-secondary)
  - [x] 2.2 Commentaire d'en-tête documente l'usage des tokens et la note WCAG AAA 8.1:1 pour amber-900 sur stone-50

- [x] **Tâche 3 — Configuration des polices Google Fonts** (AC3)
  - [x] 3.1 `inertia_layout.edge` mis à jour : `<html lang="fr">`, preconnect googleapis + gstatic, stylesheet Google Fonts avec `display=swap`
  - [x] 3.2 `@layer base` dans `app.css` applique Inter au body et Playfair Display aux h1/h2

- [x] **Tâche 4 — Initialisation shadcn/ui** (AC4)
  - [x] 4.1 `components.json` créé manuellement (`tailwind.config: ""` pour v4, alias `~/components/ui`, baseColor `stone`)
  - [x] 4.2 `inertia/lib/utils.ts` créé avec `cn()` (clsx + tailwind-merge)
  - [x] 4.3 Deps installées : `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/{react-dialog,react-select,react-slot}` + **meta-package `radix-ui`** (requis par les nouveaux templates shadcn v4)
  - [x] 4.4 `npx shadcn@latest add button input select dialog badge --yes` — 5 composants générés
  - [x] 4.5 **Correction post-génération** : shadcn a écrit les fichiers dans `./~/components/ui/` (alias `~/` non résolu par tsconfig racine) — déplacés vers `inertia/components/ui/`, dossier `./~/` supprimé. `tsconfig.json` racine corrigé avec `paths: { "~/*": ["./inertia/*"] }` pour les futures installs shadcn.

- [x] **Tâche 5 — Assets logo et favicon** (AC5)
  - [x] 5.1 `public/images/` créé
  - [x] 5.2 `_docs/logo_anta_512.png` (69 Ko) copié vers `public/images/logo_anta.png`
  - [x] 5.3 `_docs/logo_anta.png` (308 Ko) copié vers `public/favicon.png`
  - [x] 5.4 `<link rel="icon">` ajouté dans `inertia_layout.edge`

- [x] **Tâche 6 — `PublicLayout.tsx` et `AdminLayout.tsx`** (AC5, AC6)
  - [x] 6.1 `PublicLayout.tsx` créé — header sticky `bg-background/95 backdrop-blur`, logo h-10, slot main `max-w-7xl`, footer `© Anta`, Toaster conservé
  - [x] 6.2 `AdminLayout.tsx` créé — header `bg-white`, logo h-8 + badge "Admin" `text-stone-600`, slot main
  - [x] 6.3 `inertia/app.tsx` modifié : import `PublicLayout` au lieu de `Layout`
  - [x] 6.4 **Aussi** `inertia/ssr.tsx` modifié pour la cohérence (référençait également `~/layouts/default`)
  - [x] 6.5 `inertia/layouts/default.tsx` supprimé
  - [x] 6.6 Pages legacy non touchées — fonctionneront sans style (acceptable, refactor en Epic 2)

- [x] **Tâche 7 — Tests** (AC1, AC4)
  - [x] 7.1 `tests/unit/design_system/design_system.spec.ts` créé avec 15 tests couvrant : assets, CSS Tailwind, shadcn (cn + components.json + 5 composants), Edge layout, layouts React
  - [x] 7.2 `node ace test --suite unit` — **59/59 tests passent** (44 existants + 15 nouveaux)

## Dev Notes

### État actuel — Inventaire avant intervention

- **Aucun Tailwind installé** — `inertia/css/app.css` est du CSS pur custom (gray-1 → gray-12 en oklch, header/main/cards/form/alerts hardcodés). Tout sera remplacé.
- **Pas de shadcn/ui ni de Radix UI** — installation greenfield.
- **Logo disponible** : `_docs/logo_anta_512.png` et `_docs/logo_anta.png` (existence confirmée).
- **Layout actuel** : `inertia/layouts/default.tsx` contient un SVG ETEC inline + nav Login/Signup + Toaster. Sera remplacé par `PublicLayout.tsx`.
- **`inertia_layout.edge`** est très basique : `<title>` codé "AdonisJS", pas de favicon, pas de `<html lang>`, pas de fonts. À enrichir.
- **Pages legacy** : `home.tsx`, `auth/login.tsx`, `auth/signup.tsx` (héritage du starter AdonisJS) — elles utilisent les classes CSS legacy (`.hero`, `.cards`, `.form-container`). Après cette story elles se chargeront sans erreur mais auront un look dégradé (HTML brut). Elles seront refait dans Epic 2 (auth) ou supprimées car non utilisées par Anta.

### Tailwind v4 — Différences majeures avec v3 (à ne pas oublier)

- **PAS de `tailwind.config.js`** — la config se fait en CSS via `@theme`
- **PAS de `postcss.config.js`** — le plugin Vite officiel s'en occupe
- **Installation** : `tailwindcss` + `@tailwindcss/vite` (pas d'autoprefixer ni postcss)
- **Import CSS** : `@import "tailwindcss";` (une seule ligne remplace les 3 anciens `@tailwind base/components/utilities`)
- **Tokens** : déclarés en CSS variables dans `@theme { --color-X: ... }` — Tailwind génère automatiquement les classes `bg-X`, `text-X`, `border-X`, etc.
- **Format couleur recommandé** : `oklch()` (better gamut, plus prévisible que HSL/RGB). Tailwind accepte aussi hex et rgb, mais la palette par défaut v4 est en oklch.

### Tokens Anta — Conversion hex → oklch

Pour préserver la fidélité couleur, j'utilise les valeurs oklch officielles de la palette Tailwind v4 :

```css
@theme {
  /* === Palette Anta ===
   * Définit les couleurs de marque utilisables via les classes Tailwind :
   *   bg-primary, text-primary, border-primary, etc.
   *
   * Note WCAG : amber-900 (#78350f) atteint un ratio de contraste 8.1:1
   * sur fond stone-50 (#fafaf9) — conforme AAA pour texte normal ET grand.
   * Peut donc être utilisé indifféremment en texte ou en fond décoratif.
   */
  --color-primary: oklch(0.5278 0.1413 150.0);          /* green-700  #15803d */
  --color-accent: oklch(0.3742 0.0866 41.7);            /* amber-900  #78350f */
  --color-background: oklch(0.9851 0.0014 95.0);        /* stone-50   #fafaf9 */
  --color-text-secondary: oklch(0.4452 0.0107 79.0);    /* stone-600  #57534e */
}
```

⚠️ Les couleurs Tailwind standards (`green-700`, `amber-900`, etc.) **restent disponibles** par défaut. Les tokens Anta ci-dessus sont des **alias sémantiques** pour pouvoir utiliser `bg-primary` au lieu de `bg-green-700` partout (et changer de palette en une ligne si nécessaire).

### `inertia/css/app.css` — Template complet

```css
@import "tailwindcss";

@theme {
  /* === Palette Anta — voir Dev Notes Story 1.7 pour justification === */
  --color-primary: oklch(0.5278 0.1413 150.0);          /* green-700 */
  --color-accent: oklch(0.3742 0.0866 41.7);            /* amber-900 — AAA en texte OU fond sur stone-50 */
  --color-background: oklch(0.9851 0.0014 95.0);        /* stone-50 */
  --color-text-secondary: oklch(0.4452 0.0107 79.0);    /* stone-600 */
}

@layer base {
  html {
    background-color: var(--color-background);
    color: oklch(0.2755 0.0066 79.0);  /* stone-900 pour le texte principal */
  }

  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2 {
    font-family: 'Playfair Display', Georgia, serif;
    font-weight: 600;
  }
}
```

⚠️ **Suppression totale du legacy** : tout le contenu actuel de `app.css` (gray-1→12, .hero, .cards, .form-container, .alert, etc.) est **supprimé**. Les pages legacy qui en dépendaient (`home.tsx`, `login.tsx`, `signup.tsx`) afficheront du HTML brut sans style. C'est acceptable car ces pages ne sont pas Anta (starter AdonisJS) et seront remplacées en Epic 2.

### `resources/views/inertia_layout.edge` — Template complet cible

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title inertia>
      Anta
    </title>

    <link rel="icon" type="image/png" href="/favicon.png" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" />

    @viteReactRefresh()
    @vite(['inertia/app.tsx'])
    @inertiaHead()
    @stack('dumper')
  </head>

  <body>
    @inertia()
  </body>
</html>
```

⚠️ **`@vite(['inertia/app.tsx'])`** : ce layout est servi UNIQUEMENT pour l'app publique. Pour l'admin, AdonisJS utilisera probablement un layout séparé (à créer plus tard si besoin) ou le même layout avec un entry point différent. Pour cette story, on garde la situation actuelle (1 seul layout edge pour les deux apps).

### `components.json` — Configuration shadcn/ui

Préparer **avant** d'exécuter `npx shadcn add` pour éviter les prompts interactifs. Créer à la racine du projet :

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "inertia/css/app.css",
    "baseColor": "stone",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "~/components",
    "utils": "~/lib/utils",
    "ui": "~/components/ui",
    "lib": "~/lib",
    "hooks": "~/hooks"
  },
  "iconLibrary": "lucide"
}
```

⚠️ **`tailwind.config: ""`** : Tailwind v4 n'a pas de fichier config — chaîne vide signale à shadcn qu'on utilise v4.

⚠️ **`baseColor: "stone"`** : cohérent avec notre `--color-background: stone-50`.

⚠️ **Aliases avec `~/`** : on aligne sur l'alias Vite existant (`vite.config.ts` mappe `~/` sur `inertia/`).

### `inertia/lib/utils.ts` — Helper `cn`

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Helper standard shadcn — combine `clsx` (gestion conditions) + `tailwind-merge` (dédoublonne les classes Tailwind conflictuelles type `px-4 px-2` → garde le dernier).

### `PublicLayout.tsx` — Template minimaliste

```tsx
import { Data } from '@generated/data'
import { toast, Toaster } from 'sonner'
import { Link, usePage } from '@inertiajs/react'
import { ReactElement, useEffect } from 'react'

export default function PublicLayout({ children }: { children: ReactElement<Data.SharedProps> }) {
  const { props, url } = usePage<Data.SharedProps>()

  useEffect(() => {
    toast.dismiss()
  }, [url])

  useEffect(() => {
    if (props.flash?.error) toast.error(props.flash.error)
    if (props.flash?.success) toast.success(props.flash.success)
  })

  return (
    <div className="min-h-screen flex flex-col bg-background text-stone-900">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center" aria-label="Anta — Accueil">
            <img src="/images/logo_anta.png" alt="Anta" className="h-10 w-auto" />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {children}
      </main>

      <footer className="border-t border-stone-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-stone-600">
          © Anta
        </div>
      </footer>

      <Toaster position="top-center" richColors />
    </div>
  )
}
```

⚠️ **Note Inertia v2** : `<Link href="/">` est la syntaxe v2 (avec `href`), pas `<Link route="...">` (qui était la syntaxe Tuyau). On utilise `href` direct pour éviter de dépendre de routes Tuyau qui n'existent pas encore pour Anta.

⚠️ **Pas de `<LanguageSwitcher />`** : composant créé en Story 5.1, hors scope ici. Layout en français par défaut, le visiteur changera via DevTools pour tester.

⚠️ **Pas de navigation publique** : sera ajoutée en Story 5.1 (Privacy Policy, etc.).

### `AdminLayout.tsx` — Template minimaliste

```tsx
import { Link } from '@inertiajs/react'
import { Toaster } from 'sonner'
import { ReactElement } from 'react'

export default function AdminLayout({ children }: { children: ReactElement }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/admin/productions" className="flex items-center" aria-label="Anta Admin">
            <img src="/images/logo_anta.png" alt="Anta" className="h-8 w-auto" />
            <span className="ml-3 text-sm font-medium text-stone-600">Admin</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {children}
      </main>

      <Toaster position="top-center" richColors />
    </div>
  )
}
```

⚠️ **Pas de sidebar admin** : viendra en Story 2.1 (UX-DR18 — sidebar avec Productions/Statistiques/Utilisateurs).

⚠️ **Layout admin pas encore utilisé** : `admin.tsx` ne wrappe pas dans un layout. Pas de modification de `admin.tsx` dans cette story — `AdminLayout` est créé pour servir les futures pages admin (Story 2.1+). Documenter clairement ce choix.

### Modification de `inertia/app.tsx`

```typescript
// Avant :
import Layout from '~/layouts/default'

// Après :
import PublicLayout from '~/layouts/PublicLayout'

// Dans createInertiaApp :
resolve: (name) => {
  return resolvePageComponent(
    `./pages/${name}.tsx`,
    import.meta.glob('./pages/**/*.tsx'),
    (page: ReactElement<Data.SharedProps>) => <PublicLayout children={page} />
  )
},
```

### Tests — Stratégie

Pas de jsdom/testing-library dans Anta, donc pas de tests de rendu React. On teste l'**infrastructure** :

```typescript
// tests/unit/design_system/design_system.spec.ts
import { test } from '@japa/runner'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const r = (p: string) => resolve(process.cwd(), p)

test.group('Design system | assets', () => {
  test('logo principal présent dans public/images/', ({ assert }) => {
    assert.isTrue(existsSync(r('public/images/logo_anta.png')))
    assert.isAbove(statSync(r('public/images/logo_anta.png')).size, 0)
  })

  test('favicon présent à la racine de public/', ({ assert }) => {
    assert.isTrue(existsSync(r('public/favicon.png')))
  })
})

test.group('Design system | Tailwind v4', () => {
  const css = readFileSync(r('inertia/css/app.css'), 'utf-8')

  test('app.css importe Tailwind v4', ({ assert }) => {
    assert.include(css, '@import "tailwindcss"')
  })

  test('app.css définit le bloc @theme avec les tokens Anta', ({ assert }) => {
    assert.include(css, '@theme')
    assert.include(css, '--color-primary')
    assert.include(css, '--color-accent')
    assert.include(css, '--color-background')
    assert.include(css, '--color-text-secondary')
  })

  test('app.css applique Playfair Display à h1/h2 et Inter au body', ({ assert }) => {
    assert.include(css, 'Playfair Display')
    assert.include(css, 'Inter')
  })
})

test.group('Design system | shadcn/ui', () => {
  test('lib/utils.ts exporte cn()', async ({ assert }) => {
    const mod = await import('../../../inertia/lib/utils.js')
    assert.isFunction(mod.cn)
    assert.equal(mod.cn('a', 'b'), 'a b')
  })

  test('components.json existe et cible Tailwind v4', ({ assert }) => {
    const config = JSON.parse(readFileSync(r('components.json'), 'utf-8'))
    assert.equal(config.tailwind.config, '')
    assert.equal(config.tailwind.css, 'inertia/css/app.css')
    assert.equal(config.aliases.utils, '~/lib/utils')
  })

  test('composant Button shadcn généré', ({ assert }) => {
    assert.isTrue(existsSync(r('inertia/components/ui/button.tsx')))
  })
})

test.group('Design system | Edge layout', () => {
  const edge = readFileSync(r('resources/views/inertia_layout.edge'), 'utf-8')

  test('html a un attribut lang="fr"', ({ assert }) => {
    assert.include(edge, '<html lang="fr"')
  })

  test('favicon référencé', ({ assert }) => {
    assert.include(edge, '/favicon.png')
  })

  test('Google Fonts avec display=swap', ({ assert }) => {
    assert.include(edge, 'fonts.googleapis.com')
    assert.include(edge, 'display=swap')
    assert.include(edge, 'Inter')
    assert.include(edge, 'Playfair+Display')
  })
})
```

⚠️ **Import dynamique de `cn`** : `await import('../../../inertia/lib/utils.js')` — l'import dynamique évite que `cn` soit évalué au top-level (où `clsx`/`tailwind-merge` pourraient ne pas résoudre via les alias Vite).

### Pages legacy — Gestion du dégât collatéral

Après suppression de l'ancien `app.css` (avec ses classes `.hero`, `.cards`, etc.), les pages suivantes seront visuellement cassées :

- `inertia/pages/home.tsx` — utilise `.hero`, `.cards`
- `inertia/pages/auth/login.tsx` — utilise `.form-container`
- `inertia/pages/auth/signup.tsx` — utilise `.form-container`

**Décision pour cette story** : **ne pas réécrire ces pages**. Elles continueront de se rendre (HTML brut sans style appliqué via classes inexistantes). Justification :

- Ces pages sont du **starter AdonisJS Auth générique**, pas du contenu Anta
- Elles seront remplacées intégralement en Epic 2 (Story 2.2 = nouvelle Login admin, etc.)
- Garder le legacy CSS juste pour 3 pages temporaires pollue le bundle
- L'utilisateur peut ignorer ces pages pendant le développement Anta

**Action minimale** : si les pages crashent au runtime à cause de l'absence du CSS, on ajoute juste un `<h1>` minimal Tailwind pour qu'elles soient lisibles. Sinon, on n'y touche pas.

### Path alias `~/` — Confirmation

Le `vite.config.ts` actuel définit `'~/': './inertia/'`. Donc `~/components/ui/button` résout vers `inertia/components/ui/button.tsx`. Vérifier que `inertia/tsconfig.json` a aussi le path mapping (`"paths": { "~/*": ["./*"] }`) — c'est déjà le cas (vérifié pendant la création de la story).

### Anti-Patterns à Éviter

- ❌ Créer `tailwind.config.js` → ✅ config en CSS via `@theme` (Tailwind v4)
- ❌ Installer `postcss`, `autoprefixer` → ✅ `@tailwindcss/vite` s'en charge
- ❌ Utiliser `@tailwind base; @tailwind components; @tailwind utilities;` → ✅ une seule ligne `@import "tailwindcss";`
- ❌ Lancer `npx shadcn init` interactif sans `components.json` pré-préparé → ✅ écrire `components.json` à la main, puis `npx shadcn add` directement
- ❌ Mettre les composants shadcn dans `inertia/ui/` → ✅ `inertia/components/ui/` (convention shadcn + cohérent avec alias `~/components/ui`)
- ❌ Mettre le logo dans `inertia/assets/` (importé par Vite) → ✅ `public/images/` (servi statiquement, URL prévisible `/images/logo_anta.png`)
- ❌ Référencer le logo avec `import logo from '~/assets/logo.png'` → ✅ chemin URL direct `/images/logo_anta.png` (pas de hash Vite, pas de bundle)
- ❌ Hardcoder les couleurs dans les composants (`#15803d`) → ✅ utiliser les classes Tailwind (`text-primary`, `bg-primary`)
- ❌ Garder l'ancien `default.tsx` ET créer `PublicLayout.tsx` → ✅ supprimer `default.tsx`, un seul layout public
- ❌ Refactor toutes les pages legacy AdonisJS dans cette story → ✅ hors scope, elles seront refait/supprimées en Epic 2
- ❌ Créer sidebar admin dans `AdminLayout.tsx` → ✅ hors scope, viendra en Story 2.1 (UX-DR18)
- ❌ Charger les Google Fonts sans `display=swap` → ✅ avec `display=swap` (évite le FOIT — flash of invisible text)
- ❌ Oublier `<link rel="preconnect">` pour les fonts → ✅ préconnect réduit ~200ms le first font paint

### Project Structure Notes

**Fichiers créés par cette story :**
- `components.json` (racine) — config shadcn
- `inertia/lib/utils.ts` — helper `cn`
- `inertia/components/ui/{button,input,select,dialog,badge}.tsx` — composants shadcn générés
- `inertia/layouts/PublicLayout.tsx` — layout public minimal
- `inertia/layouts/AdminLayout.tsx` — layout admin minimal
- `public/images/logo_anta.png` — logo principal
- `public/favicon.png` — favicon
- `tests/unit/design_system/design_system.spec.ts` — tests structurels

**Fichiers modifiés par cette story :**
- `inertia/css/app.css` — réécrit complètement (Tailwind v4 + tokens Anta + fonts)
- `inertia/app.tsx` — import `PublicLayout` au lieu de `default`
- `vite.config.ts` — ajout plugin `tailwindcss()`
- `resources/views/inertia_layout.edge` — fonts, favicon, html lang
- `package.json` — ajout `tailwindcss`, `@tailwindcss/vite`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/*` (3 packages)

**Fichiers supprimés :**
- `inertia/layouts/default.tsx`

**Pas modifié :**
- `inertia/admin.tsx` — n'a pas de layout actuellement, et `AdminLayout` sera intégré en Story 2.1 quand les pages admin existeront
- Pages legacy (`home.tsx`, `auth/*.tsx`) — dégradées visuellement, acceptable

### Previous Story Intelligence (Stories 1.1 → 1.6)

**Patterns à reproduire :**
- Installation : `npm install` direct + scripts CLI dédiés (`npx shadcn add` ici, comme `node ace configure` pour les packages AdonisJS)
- Tests Japa Node-pur sur infrastructure (cohérent avec Story 1.6 i18n qui teste les JSON sans React)
- Chemins relatifs dans les tests qui importent depuis `inertia/`
- Documenter les choix de divergence/scope dans les Dev Notes

**Gotchas découverts précédemment et pertinents ici :**
- **`assert.throws()` Japa** attend un constructeur — ne pas l'utiliser ici car on teste de l'infrastructure (pas d'erreur attendue)
- **Imports JSON dans les tests** — utiliser `readFileSync` + `JSON.parse` pour éviter les assert json
- **Vite re-optimise** après install de nouvelles deps (Tailwind, Radix) — premier `npm run dev` ou `node ace test` sera lent

### Cas d'usage MVP de ce design system

Ce setup est la **fondation visuelle** de toutes les futures stories Anta :

- **Stories 4.x** (panel admin productions) utiliseront `Button`, `Input`, `Select`, `Dialog`, `Badge` directement
- **Story 5.1** (PublicLayout final) enrichira `PublicLayout.tsx` avec navigation, LanguageSwitcher, etc.
- **Story 2.1** (AdminLayout final) enrichira `AdminLayout.tsx` avec sidebar, badge rôle, warning mobile
- **Story 4.4** (FileUploader UX-DR7) utilisera la palette green-700 pour l'état drag-over

L'investissement dans la story est payé sur toute la durée du projet — d'où l'importance de bien définir les tokens et le pattern d'usage maintenant.

### References

- [Source: epics.md#Story 1.7] — Acceptance Criteria de base
- [Source: ux-design-specification.md] — UX-DR15 (design system tokens), UX-DR20 (accessibilité), palette green-700/amber-900/stone-50
- [Source: architecture.md#5. Frontend et UI] — Tailwind v4 + shadcn/ui confirmés
- [Source: Tailwind v4 docs] — `@import "tailwindcss"`, `@theme`, plugin `@tailwindcss/vite`
- [Source: shadcn/ui docs] — `components.json`, CLI `npx shadcn add`, structure `components/ui/`
- [Source: inertia/app.tsx] — Wrapping pattern via `setup({ ... })`
- [Source: vite.config.ts] — Alias `~/` confirmé

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- **shadcn v4 utilise le meta-package `radix-ui`** (importe via `import { Slot } from "radix-ui"` etc.) au lieu des sous-packages historiques `@radix-ui/react-*`. Le meta-package `radix-ui@1.4.3` a été installé en complément.
- **shadcn n'a pas résolu l'alias `~/` au moment d'écrire les fichiers** — le `tsconfig.json` racine n'a pas l'alias (il est seulement dans `inertia/tsconfig.json`). Résultat : fichiers écrits littéralement dans `./~/components/ui/`. Déplacés manuellement vers `inertia/components/ui/` + ajouté `"paths": { "~/*": ["./inertia/*"] }` au `tsconfig.json` racine pour fixer les futures installs shadcn. Note : les imports DANS les fichiers (`import { cn } from "~/lib/utils"`) sont bien résolus par Vite au runtime, c'était uniquement le PATH D'ÉCRITURE qui était cassé.
- `inertia/ssr.tsx` référençait aussi `~/layouts/default` — mis à jour vers `PublicLayout` pour cohérence (n'aurait pas cassé immédiatement car SSR est désactivé dans `config/inertia.ts`, mais éviter une bombe à retardement).
- Vite re-optimise les deps au premier run après installation Tailwind+shadcn (~30s avant que les tests démarrent). Runs suivants instantanés.

### Completion Notes List

- AC1 ✅ Tailwind v4 installé via plugin Vite, classes utilisables (vérifié indirectement par compilation sans erreur + tests d'inspection CSS)
- AC2 ✅ 4 tokens Anta dans `@theme`, commentaire WCAG AAA documenté
- AC3 ✅ Polices Inter + Playfair Display chargées avec `display=swap` + preconnect
- AC4 ✅ shadcn initialisé, `cn()` fonctionnel (test inclut `cn('p-2', 'p-4') === 'p-4'` qui valide tailwind-merge), 5 composants générés
- AC5 ✅ Logo et favicon copiés, `<html lang="fr">`, layouts utilisent les bonnes tailles (h-10 public, h-8 admin)
- AC6 ✅ Layouts créés, `app.tsx` mis à jour, `default.tsx` supprimé, pages legacy intactes
- AC7 ⏳ Validation visuelle requiert `npm run dev` manuel par l'utilisateur — non testée automatiquement (pas de jsdom)
- **Total : 59/59 tests** (44 existants + 15 design system)

### Change Log

- 2026-05-30 : Implémentation Story 1.7 — Tailwind v4 + tokens Anta + shadcn/ui (5 composants) + Inter/Playfair Google Fonts + logo & favicon + PublicLayout/AdminLayout. Fix tsconfig racine pour l'alias `~/` (shadcn ne le résolvait pas). Suppression de `default.tsx`. 15 nouveaux tests.

### File List

**Créés :**
- `components.json` — config shadcn pour Anta
- `inertia/lib/utils.ts` — helper `cn()`
- `inertia/components/ui/button.tsx`
- `inertia/components/ui/input.tsx`
- `inertia/components/ui/select.tsx`
- `inertia/components/ui/dialog.tsx`
- `inertia/components/ui/badge.tsx`
- `inertia/layouts/PublicLayout.tsx`
- `inertia/layouts/AdminLayout.tsx`
- `public/images/logo_anta.png`
- `public/favicon.png`
- `tests/unit/design_system/design_system.spec.ts` (15 tests)

**Modifiés :**
- `inertia/css/app.css` — réécrit (Tailwind v4 + tokens + fonts, plus de legacy)
- `inertia/app.tsx` — import `PublicLayout`
- `inertia/ssr.tsx` — import `PublicLayout` (cohérence SSR)
- `vite.config.ts` — ajout plugin `tailwindcss()`
- `tsconfig.json` — ajout `baseUrl` et `paths: { "~/*": ["./inertia/*"] }` pour shadcn
- `resources/views/inertia_layout.edge` — fonts, favicon, html lang
- `package.json` — ajout `tailwindcss`, `@tailwindcss/vite`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-{dialog,select,slot}`, `radix-ui` (meta)

**Supprimés :**
- `inertia/layouts/default.tsx`
