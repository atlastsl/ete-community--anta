# Story 5.1 : Layout public et page Politique de confidentialité

Status: review

<!-- Note: Validation optionnelle. Lancer validate-create-story pour un contrôle qualité avant dev-story. -->

## Story

En tant que visiteur,
Je veux naviguer sur un site avec un header clair et accéder à la politique de confidentialité,
Afin de comprendre comment mes données sont traitées et de naviguer dans un cadre de confiance (FR38, FR40, FR41).

> **Première story de l'Epic 5 (Site Public).** Elle pose le socle de navigation publique : `PublicLayout` enrichi (header + LanguageSwitcher + footer), composant `LanguageSwitcher` réutilisable, et page `/privacy-policy`. Les stories 5.2 → 5.7 (homepage, recherche, listing, SEO, a11y, tests) s'appuieront sur ce layout. **Ne PAS implémenter** la homepage, la recherche ni les filtres ici.

## Acceptance Criteria

**AC1 — Header sticky + footer sur toutes les pages publiques**

- **Given** un visiteur charge n'importe quelle page du site public
- **When** `PublicLayout.tsx` se rend
- **Then** un header sticky affiche le logo Anta (`/images/logo_anta.png`, `h-10`, lien vers `/`) et le composant `LanguageSwitcher` (FR/EN) visible
- **And** un footer affiche un lien vers la politique de confidentialité (clé i18n `nav.privacy_policy`) + le copyright communauté

**AC2 — Changement de langue immédiat + persistance cookie**

- **Given** un visiteur clique sur "FR" ou "EN" dans le `LanguageSwitcher`
- **When** la langue change
- **Then** toute l'interface bascule immédiatement dans la langue sélectionnée via `react-i18next` (`i18n.changeLanguage()`)
- **And** la sélection est sauvegardée dans le cookie `i18n_lang` (FR40, FR41) — comportement déjà fourni par `LanguageDetector` (`caches: ['cookie', 'localStorage']`)
- **And** `aria-current="true"` est appliqué sur le bouton de la langue active (et absent sur l'autre)

**AC3 — Restauration de la langue à la visite suivante**

- **Given** un visiteur revient sur le site lors d'une visite suivante
- **When** l'application se charge
- **Then** la langue précédemment choisie est restaurée depuis le cookie `i18n_lang` (ordre de détection : `cookie → localStorage → navigator → fr` — déjà configuré dans `shared.ts`)

**AC4 — Page `/privacy-policy` accessible depuis le footer**

- **Given** un visiteur accède à `/privacy-policy`
- **When** la page se charge
- **Then** la politique de confidentialité s'affiche dans la langue active (contenu via `react-i18next`, jamais en dur)
- **And** la page est accessible via le lien du footer présent sur toutes les pages publiques (FR38)
- **And** la route répond `200`

**AC5 — Tests automatisés**

- **Given** la suite de tests est exécutée (`node ace test`)
- **When** les specs de cette story tournent
- **Then** au minimum :
  - `GET /` → `200`
  - `GET /privacy-policy` → `200`
  - Parité des clés i18n FR/EN préservée (test existant `translations.spec.ts` reste vert après ajout des nouvelles clés)
  - Assertions source sur `LanguageSwitcher` (Node-pur) : présence de `useTranslation`, `i18n.changeLanguage`, `aria-current`, et des deux langues

## Tasks / Subtasks

- [x] **Tâche 1 — Composant `LanguageSwitcher` réutilisable** (AC1, AC2)
  - [x] 1.1 Créer `inertia/components/shared/LanguageSwitcher.tsx` (dossier `shared/` cohérent avec `Pagination.tsx` existant ; le composant lit son instance i18n depuis le `I18nextProvider` ambiant → fonctionne en public ET admin)
  - [x] 1.2 Utiliser `const { i18n, t } = useTranslation()`. Langue active : `i18n.resolvedLanguage ?? i18n.language`
  - [x] 1.3 Rendre deux boutons `FR` / `EN` (séparés visuellement par `|`). `onClick={() => i18n.changeLanguage('fr'|'en')}`
  - [x] 1.4 `aria-current="true"` sur le bouton actif uniquement (`undefined` sinon). État visuel actif distinct (ex. `font-semibold text-green-700`), inactif `text-stone-600 hover:text-stone-900`
  - [x] 1.5 Wrapper `<nav aria-label={t('language_switcher.label')}>` pour l'accessibilité. Boutons `type="button"`
  - [x] 1.6 Aucun hardcode de texte : labels `language_switcher.fr` / `.en` disponibles si besoin d'un tooltip ; les sigles `FR`/`EN` sont des sigles invariants acceptables

- [x] **Tâche 2 — Enrichir `PublicLayout.tsx`** (AC1, AC4)
  - [x] 2.1 Importer et insérer `<LanguageSwitcher />` dans le header, à droite (le `<div>` flex `justify-between` est déjà en place — le logo reste à gauche)
  - [x] 2.2 Remplacer le footer `© Anta` minimal par : copyright communauté (clé i18n `footer.copyright`) + lien `<Link href="/privacy-policy">{t('nav.privacy_policy')}</Link>`
  - [x] 2.3 Ajouter `const { t } = useTranslation()` au layout. **Conserver** la logique flash/toast existante (`useEffect` sur `flash` et `url`) et le `<Toaster>` — ne pas la dupliquer ni la retirer
  - [x] 2.4 Header sémantique `<header>` déjà présent et `sticky top-0` déjà en place — conserver

- [x] **Tâche 3 — Contenu i18n de la politique de confidentialité** (AC4)
  - [x] 3.1 Ajouter dans `inertia/locales/public/fr.json` et `en.json` (clés **identiques** dans les deux — parité obligatoire) :
    - `footer.copyright` (ex. `"© Anta — Communauté"`)
    - namespace `privacy` : `title`, et des sections (`intro`, `data_collected`, `data_usage`, `data_retention`, `rights`, `contact`) — chaque section avec `heading` + `body`
  - [x] 3.2 Rédiger un contenu RGPD factuel et sobre (collecte de données minimale, finalité, conservation, droits, contact). **Action utilisateur** : faire relire/valider le texte légal — voir Questions en fin de story
  - [x] 3.3 Vérifier que `translations.spec.ts` reste vert (parité FR/EN + valeurs non vides)

- [x] **Tâche 4 — Page `PrivacyPolicy` + route** (AC4)
  - [x] 4.1 Créer `inertia/pages/privacy-policy.tsx` (convention plate, cohérente avec `home.tsx` existant). Composant fonctionnel rendant le contenu via `useTranslation()` (`privacy.*`)
  - [x] 4.2 Structure sémantique : `<article>` avec un `<h1>` unique (`privacy.title`) puis sections `<section>` (`<h2>` + paragraphe). Largeur de lecture confortable (`max-w-3xl`, prose) — le `<main>` du layout fournit déjà le conteneur
  - [x] 4.3 La page hérite automatiquement de `PublicLayout` (HOC par défaut dans `app.tsx`) — **ne PAS** ajouter de `.layout` ni re-wrapper
  - [x] 4.4 Ajouter la route dans `start/routes.ts` : `router.on('/privacy-policy').renderInertia('privacy-policy', {}).as('privacy-policy')` (placer près de la route `home`, hors des groupes `/admin` et legacy)

- [x] **Tâche 5 — Tests** (AC5)
  - [x] 5.1 `tests/functional/public/privacy.spec.ts` : `test.group` avec `GET /` → 200 et `GET /privacy-policy` → 200. (Le smoke test `/` existe déjà ; éviter la duplication exacte — se concentrer sur `/privacy-policy`)
  - [x] 5.2 (Optionnel mais recommandé) Assertion Inertia : `client.get('/privacy-policy').header('X-Inertia', 'true').header('X-Inertia-Version', ...)` → vérifier le `component: 'privacy-policy'` dans le JSON. Si trop fragile (version Inertia), se limiter au 200
  - [x] 5.3 `tests/unit/components/language_switcher.spec.ts` (Node-pur, pattern établi Story 2.1 Tâche 9 — pas de testing-library) : lire le source de `LanguageSwitcher.tsx` et asserter la présence de `useTranslation`, `i18n.changeLanguage`, `aria-current`, `'fr'` et `'en'`
  - [x] 5.4 Vérifier `translations.spec.ts` (parité + non vide) vert avec les nouvelles clés

- [x] **Tâche 6 — Validation finale**
  - [x] 6.1 `node ace test` → 249/249 verts (aucun échec, flaky GIN index non reproduit cette fois)
  - [x] 6.2 `npm run lint` → 0 erreur
  - [x] 6.3 `npm run typecheck` → 0 erreur
  - [ ] 6.4 Test manuel `npm run dev` (**à faire par l'utilisateur** — navigateur) : header + switcher sur `/`, bascule FR↔EN immédiate, rechargement conserve la langue (cookie), footer → `/privacy-policy` rend le contenu dans la langue active

## Dev Notes

### Architecture cible (synthèse)

- **`LanguageSwitcher` partagé** : un seul composant, placé dans `inertia/components/shared/`. Il lit l'instance i18n du `I18nextProvider` ambiant (`publicI18n` côté public via `app.tsx`, `adminI18n` côté admin via `admin.tsx`). Aucune dépendance à une instance précise → réutilisable tel quel. **Spec UX : "composant `<LanguageSwitcher />` partagé — même comportement public et admin"** [Source: architecture.md#Internationalisation, ux-design-specification.md#LanguageSwitcher].
- **`PublicLayout` = layout par défaut** : `app.tsx` enveloppe **toutes** les pages publiques via le HOC `(page) => <PublicLayout children={page} />`. Ajouter le switcher/footer ici les rend présents partout — c'est ce qu'exige l'AC1/AC4 ("sur toutes les pages").
- **Page statique = `renderInertia` sans contrôleur** : `/privacy-policy` n'a pas de logique métier → route `router.on(...).renderInertia('privacy-policy', {})` suffit (même pattern que `home`). Pas besoin de créer un contrôleur.

### État existant à RESPECTER (déjà en place — ne pas réinventer)

- `inertia/lib/i18n/shared.ts` — **toute la persistance cookie est déjà implémentée** : `LanguageDetector`, `lookupCookie: 'i18n_lang'`, `caches: ['cookie', 'localStorage']`, `cookieMinutes` 1 an, `cookieOptions` (path `/`, `sameSite lax`, `secure` en prod). **AC2 et AC3 sont satisfaits par cette config dès lors qu'on appelle `i18n.changeLanguage()`** — ne PAS écrire de logique cookie manuelle (`document.cookie`).
- `inertia/lib/i18n/public.ts` — instance `publicI18n` (charge `locales/public/{fr,en}.json`). Déjà branchée dans `app.tsx` via `<I18nextProvider i18n={publicI18n}>`.
- `inertia/locales/public/{fr,en}.json` — contiennent **déjà** `nav.privacy_policy` et `language_switcher.{fr,en,label}`. Réutiliser ces clés ; ne pas les redéfinir.
- `inertia/layouts/PublicLayout.tsx` — header sticky + logo + footer minimal + gestion flash/Toaster déjà présents. **Enrichir**, ne pas réécrire de zéro.
- `inertia/components/shared/Pagination.tsx` — précédent d'un composant partagé dans `shared/` ; suivre la même localisation.
- `inertia/components/ui/button.tsx` — bouton shadcn disponible (optionnel pour le switcher ; des `<button>` natifs stylés Tailwind conviennent aussi et restent plus légers pour 2 sigles).
- `start/routes.ts` — route `home` via `router.on('/').renderInertia('home', {})` ; pattern à reproduire pour `/privacy-policy`.
- `public/images/logo_anta.png` — asset logo déjà servi en statique (`h-10` en header public).

### Conventions et patterns

- **i18n** : 100% des textes via `useTranslation()` / `t()` — jamais de chaîne en dur dans le JSX (sigles `FR`/`EN` invariants tolérés). [Source: architecture.md#Guidelines d'Implémentation].
- **Parité des clés** : toute clé ajoutée dans `fr.json` DOIT exister à l'identique dans `en.json` (le test `translations.spec.ts` échoue sinon — `assert.deepEqual` sur les clés triées).
- **Nommage pages publiques** : plat + kebab-case minuscule (`home.tsx`, `privacy-policy.tsx`) — cohérent avec l'existant. Les pages admin utilisent un sous-dossier `admin/` PascalCase ; **les pages publiques restent à plat** dans la base de code actuelle.
- **Inertia `renderInertia`** : toujours passer `{}` comme 2e argument même sans props (sinon erreur TS `inertia.render` — cf. Story 2.1).
- **Layout HOC** : ne PAS définir `Component.layout` sur les pages publiques — le HOC par défaut de `app.tsx` applique déjà `PublicLayout`. (À l'inverse des pages admin qui déclarent `.layout`.)
- **`<Link>` Inertia** : utiliser `import { Link } from '@adonisjs/inertia/react'` (typesafe Tuyau) pour la navigation interne (logo, lien footer) — déjà importé dans `PublicLayout`.
- **Tests** : Japa. Specs fonctionnelles dans `tests/functional/`, unitaires dans `tests/unit/`. Fallback Node-pur (assertions sur le source) si pas de testing-library — pattern validé Stories 1.7 / 2.1.
- **Accessibilité (cible Epic 5)** : `<header>`, `<main>`, `<footer>`, `<nav>` sémantiques ; `aria-current` sur l'état actif ; un seul `<h1>` par page. (L'audit a11y complet est Story 5.6 — mais poser les bonnes bases ici évite la dette.)

### Anti-patterns à éviter

- ❌ Écrire `document.cookie = 'i18n_lang=...'` à la main — la persistance est gérée par `LanguageDetector` (`caches`). Appeler uniquement `i18n.changeLanguage()`.
- ❌ Créer deux `LanguageSwitcher` (un public, un admin) — le composant partagé est agnostique de l'instance i18n. Un seul fichier dans `shared/`.
- ❌ Réécrire `PublicLayout` de zéro et perdre la gestion flash/`<Toaster>` existante — enrichir l'existant.
- ❌ Hardcoder le titre/sections de la politique de confidentialité dans le JSX — passer par `privacy.*` i18n.
- ❌ Créer un contrôleur pour `/privacy-policy` — `renderInertia` suffit (page statique).
- ❌ Ajouter `.layout` sur `privacy-policy.tsx` ou re-wrapper dans `<PublicLayout>` — double layout (le HOC de `app.tsx` l'applique déjà).
- ❌ Toucher à `home.tsx`, aux filtres, à la recherche ou à la homepage — hors périmètre (Stories 5.2/5.3).
- ❌ `<a href>` natif pour la navigation interne — utiliser `<Link>` Inertia (pas de full reload).

### Sécurité / conformité

- La page `/privacy-policy` est **publique et indexable** (contrairement au panel admin noindexé — Story 2.5). Ne pas y appliquer de `noindex`.
- Le cookie `i18n_lang` n'est **pas** `HttpOnly` (JS doit l'écrire) — c'est intentionnel et documenté dans `shared.ts`. `sameSite: lax`, `secure` en prod. Aucune donnée sensible.
- Contenu RGPD : décrire la collecte réelle (cookie de langue, éventuels compteurs de vues/téléchargements anonymes des Epics 6/7). Rester factuel ; ne pas promettre ce qui n'est pas implémenté.

### Project Structure Notes

**Fichiers créés :**

- `inertia/components/shared/LanguageSwitcher.tsx`
- `inertia/pages/privacy-policy.tsx`
- `tests/functional/public/privacy.spec.ts`
- `tests/unit/components/language_switcher.spec.ts`

**Fichiers modifiés :**

- `inertia/layouts/PublicLayout.tsx` — ajout `<LanguageSwitcher />` (header) + lien privacy & copyright (footer) + `useTranslation`
- `inertia/locales/public/fr.json` — ajout `footer.copyright` + namespace `privacy`
- `inertia/locales/public/en.json` — équivalent EN (parité)
- `start/routes.ts` — route `/privacy-policy`

**Variance architecture vs base de code (à connaître) :**

> L'`architecture.md` décrit une arborescence idéalisée (`inertia/pages/public/PrivacyPolicy.tsx`, `inertia/components/public/LanguageSwitcher.tsx`, `start/routes/public.ts`). **La base de code réelle (Stories 1–4) a divergé** : pages publiques à plat (`home.tsx`), composants partagés dans `shared/`, routes centralisées dans `start/routes.ts`, contrôleurs en snake_case. **Suivre la base de code réelle**, pas le doc d'architecture, pour rester cohérent. Le sous-dossier `pages/public/` n'existe pas et n'est PAS créé ici (créer toute l'arbo `public/` serait un refactor hors périmètre de 5.1).

### Previous Story Intelligence (Epic 4 + Story 1.6/1.7/2.1)

- **Story 1.6 (i18n setup)** : instances séparées `publicI18n`/`adminI18n` via `createI18nInstance`. Détection `cookie → localStorage → navigator → fr`. `useSuspense: false` (resources inline = synchrone). `resolveJsonModule` actif (imports JSON OK).
- **Story 1.7 (design system)** : `app.tsx` utilise `PublicLayout` (ex-`default.tsx`). Couleur primaire green-700 (`#15803d`). Composants shadcn dans `components/ui/`.
- **Story 2.1 (layouts admin)** : pattern tests Node-pur pour composants (pas de testing-library installée) ; `renderInertia`/`inertia.render` exige 2 args ; layout HOC typé `ReactElement` sans générique.
- **Gotcha codegen `.adonisjs`** (Stories 1.8/2.1) : ajouter une route régénère `.adonisjs/server/*` et `database/schema.ts` ; **committer ces fichiers générés** (le build Render/Vite en dépend pour le registry Tuyau). Ne pas les éditer à la main.
- **Tests fonctionnels** : `@japa/api-client` suit 5 redirects par défaut — ici on attend des 200 directs, pas de souci. (`.redirects(0)` seulement si on testait des 302.)

### Latest Tech Information

- **react-i18next v15+** : `useTranslation()` retourne `{ t, i18n }`. `i18n.changeLanguage('en')` déclenche le re-render + persiste via `LanguageDetector.caches`. Langue résolue : `i18n.resolvedLanguage`.
- **i18next-browser-languagedetector** : `caches: ['cookie', 'localStorage']` écrit automatiquement le cookie `i18n_lang` à chaque `changeLanguage` — aucune écriture manuelle requise.
- **Inertia 2.x + AdonisJS** : `router.on('/path').renderInertia('PageName', props)` rend une page sans contrôleur. Le nom résout `./pages/PageName.tsx` via le `resolve` de `app.tsx`.

### Questions / clarifications (pour l'utilisateur, à traiter après lecture)

1. **Contenu légal de la politique de confidentialité** : le dev fournira un texte RGPD factuel par défaut (collecte minimale, finalités, conservation, droits, contact). **Souhaitez-vous fournir/valider le texte légal exact**, ou un placeholder structuré sérieux est-il acceptable pour le MVP ? (email de contact à confirmer.)
2. **Style du `LanguageSwitcher`** : sigles `FR | EN` (compact, conforme au wireframe UX). Confirmez-vous ce rendu plutôt qu'un dropdown ?

### References

- [Source: epics.md#Story 5.1] — Acceptance Criteria d'origine (FR38, FR40, FR41)
- [Source: epics.md#Epic 5] — Périmètre site public, FR/NFR/UX-DR couverts
- [Source: architecture.md#Internationalisation (i18n)] — `react-i18next`, cookie `i18n_lang`, fichiers `locales/{public,admin}`, composant `<LanguageSwitcher />` partagé
- [Source: architecture.md#Frontières des Routes] — Site public préfixe `/`, aucun middleware, FR38 inclus
- [Source: architecture.md#Conformité] — FR38 politique de confidentialité (RGPD)
- [Source: ux-design-specification.md#LanguageSwitcher] — Clic → `changeLanguage` + cookie + `aria-current="true"`
- [Source: ux-design-specification.md#Navigation Site Public] — Header sticky (logo h-10 + FR|EN), footer (politique + copyright)
- [Source: ux-design-specification.md#Logo] — Logo `h-10` header public, lien `/`, alt "Anta"
- [Source: inertia/lib/i18n/shared.ts] — Persistance cookie/localStorage déjà implémentée
- [Source: inertia/layouts/PublicLayout.tsx] — Layout existant à enrichir
- [Source: inertia/locales/public/fr.json] — Clés `nav.privacy_policy`, `language_switcher.*` déjà présentes
- [Source: inertia/app.tsx] — `PublicLayout` comme HOC par défaut + `publicI18n` provider
- [Source: start/routes.ts] — Pattern `router.on('/').renderInertia('home', {})`
- [Source: Story 1.6] — Setup i18n, détection langue, parité clés
- [Source: Story 2.1] — Tests Node-pur composants, gotchas `renderInertia` / `.adonisjs` codegen

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- **Codegen `.adonisjs/server/pages.d.ts`** : la page `privacy-policy` n'était pas indexée après création du fichier TSX → typecheck échouait (`'"privacy-policy"' is not assignable to 'keyof InertiaPages'`). Fix : ajout manuel de l'entrée dans `pages.d.ts`. Le `node ace test` (qui lance `codegen: created 6 file(s)`) a ensuite confirmé la régénération automatique.

### Completion Notes List

- AC1–AC4 satisfaits, AC5 (tests) vert
- `LanguageSwitcher` créé dans `components/shared/` — composant partagé agnostique de l'instance i18n, réutilisable côté admin
- `PublicLayout` enrichi : LanguageSwitcher dans le header + footer avec copyright i18n + lien politique de confidentialité
- Page `privacy-policy.tsx` créée avec contenu RGPD factuel via i18n (6 sections FR/EN)
- Route `/privacy-policy` ajoutée (pattern `renderInertia` comme `/`)
- Tests : 249/249 verts, lint 0, typecheck 0
- Tâche 6.4 (test manuel navigateur) restante — à faire par l'utilisateur
- Email de contact dans la politique : `contact@anta.community` (placeholder — à valider par l'utilisateur)

### File List

**Créés :**
- `inertia/components/shared/LanguageSwitcher.tsx`
- `inertia/pages/privacy-policy.tsx`
- `tests/functional/public/privacy.spec.ts`
- `tests/unit/components/language_switcher.spec.ts`

**Modifiés :**
- `inertia/layouts/PublicLayout.tsx` — ajout LanguageSwitcher (header) + footer enrichi (copyright i18n + lien privacy)
- `inertia/locales/public/fr.json` — ajout `footer.copyright` + namespace `privacy` (6 sections)
- `inertia/locales/public/en.json` — équivalent EN (parité complète)
- `start/routes.ts` — ajout route `/privacy-policy`
- `.adonisjs/server/pages.d.ts` — entrée `privacy-policy` ajoutée (codegen)

### Change Log

- 2026-06-01 : Implémentation Story 5.1 (Layout public et page Politique de confidentialité). Composant `LanguageSwitcher` réutilisable (FR/EN avec `aria-current`), enrichissement `PublicLayout` (switcher header + footer copyright/privacy), page `/privacy-policy` avec contenu RGPD i18n, route `renderInertia`. 4 nouveaux fichiers, 5 modifiés. Tests : 249/249 verts, lint+typecheck verts.
