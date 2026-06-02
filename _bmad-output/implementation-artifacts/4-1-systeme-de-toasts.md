# Story 4.1 : Système de toasts (notifications admin)

Status: done

## Story

En tant qu'administrateur,
Je veux recevoir des notifications visuelles claires après chaque action,
Afin de savoir immédiatement si une opération a réussi ou échoué (UX-DR13).

## Acceptance Criteria

**AC1 — Toast de succès**

- **Given** le système de toasts est implémenté
- **When** une action réussit (création, enregistrement, publication...)
- **Then** un toast vert s'affiche **en bas à droite** pendant **3 secondes** avec le message de succès

**AC2 — Toast d'erreur système (persistant)**

- **Given** une erreur système survient (erreur réseau, upload échoué, action refusée...)
- **When** l'erreur est remontée
- **Then** un toast rouge **persistant** s'affiche avec un **bouton "Fermer"** et ne disparaît pas automatiquement

**AC3 — Toast d'info**

- **Given** une action neutre (copie de lien, information)
- **When** elle est déclenchée
- **Then** un toast neutre (gris) s'affiche pendant **3 secondes**

**AC4 — Empilement limité (max 3)**

- **Given** plusieurs toasts sont déclenchés simultanément
- **When** ils s'affichent
- **Then** ils se superposent verticalement (**max 3 simultanés**)
- **And** les plus anciens disparaissent en premier si la limite est atteinte

**AC5 — Accessibilité (UX-DR20)**

- **Given** le système de toasts utilise `aria-live`
- **When** un toast apparaît
- **Then** `role="status"` et `aria-live="polite"` sont présents sur le conteneur de toasts

## Tasks / Subtasks

- [x] **Tâche 1 — Créer un helper de notification centralisé** (AC1, AC2, AC3)
  - [x] 1.1 `inertia/lib/notify.ts` créé (encapsule sonner)
  - [x] 1.2 Fonction pure `toastOptionsFor` isolée dans `inertia/lib/notify_options.ts` (zéro import sonner) : error → `{ duration: Number.POSITIVE_INFINITY, closeButton: true }` ; success/info → `{ duration: 3000 }`
  - [x] 1.3 `notify.success/error/info` appellent `toast.*` avec `toastOptionsFor(...)`
  - [x] 1.4 `info` → `toast(message, ...)` neutre (pas de variante colorée)

- [x] **Tâche 2 — Configurer le `<Toaster>` selon UX-DR13** (AC1, AC4, AC5)
  - [x] 2.1 `<Toaster position="bottom-right" richColors closeButton visibleToasts={3} />`
  - [x] 2.2 Aria vérifié — voir Debug Log (sonner pose `aria-live="polite"` nativement ; `role="status"` documenté)

- [x] **Tâche 3 — Refactorer le pont flash → toast dans AdminLayout** (AC1, AC2)
  - [x] 3.1 useEffect utilise `notify.*`
  - [x] 3.2 `flash.success` → `notify.success(...)` (3s)
  - [x] 3.3 `flash.error` → `notify.error(...)` (persistant + Fermer)
  - [x] 3.4 `flash.tempPassword` conservé en toast warning persistant (ambre, closeButton)
  - [x] 3.5 `toast.dismiss()` au changement d'URL conservé

- [x] **Tâche 4 — Tests** (AC1, AC2, AC3)
  - [x] 4.1/4.2 `tests/unit/lib/notify.spec.ts` créé. Décision : l'import cross-projet de code `inertia/` casse le typecheck (TS6305) et sonner est une dépendance DOM → suivi de la convention du projet (lecture de source via `fs`, comme `admin_layout.spec`/`translations.spec`). 7 tests : valeurs d'options (error persistant+closeButton, success/info 3000), wiring `notify` (success/error/info), config `<Toaster>` (bottom-right, visibleToasts=3, closeButton), routage flash→notify.

- [x] **Tâche 5 — Validation finale**
  - [x] 5.1 `node ace test` → 185 tests passent (178 + 7)
  - [x] 5.2 `npm run lint` → 0 erreur
  - [x] 5.3 `npm run typecheck` → 0 erreur
  - [x] 5.4 Vérification visuelle : à faire manuellement au prochain run de l'app (non bloquant)

## Dev Notes

### État actuel — ce qui existe déjà

Le système de toasts est **partiellement implémenté** via `sonner` (déjà utilisé en Epic 2/3) :

- **Dépendance** : `sonner@^2.0.7` (présente dans `package.json`).
- **`AdminLayout.tsx`** : importe `{ toast, Toaster } from 'sonner'`, rend `<Toaster position="top-center" richColors />`, et un `useEffect` convertit les flash messages serveur en toasts :
  ```tsx
  useEffect(() => {
    if (flash?.error) toast.error(t(flash.error, { defaultValue: flash.error }))
    if (flash?.success) toast.success(t(flash.success, { defaultValue: flash.success }))
    if (flash?.tempPassword) {
      toast.warning(`${t('users.temp_password_label')} : ${flash.tempPassword}`, {
        duration: Infinity, closeButton: true,
      })
    }
  }, [flash?.error, flash?.success, flash?.tempPassword, t])
  ```
- **Partage flash** : `inertia_middleware.ts` partage `flash: { error, success, tempPassword }` à toutes les pages Inertia.

### Écarts à corriger vs UX-DR13

| Exigence UX-DR13 | Actuel | Cible |
|---|---|---|
| Position | `top-center` | **`bottom-right`** |
| Succès | défaut sonner (~4s) | **3 s** |
| Erreur | auto-dismiss, pas de bouton | **persistant + bouton Fermer** |
| Max simultanés | défaut sonner (3) | **`visibleToasts={3}` explicite** |
| Info (gris) | absent | **ajouté (3 s, neutre)** |
| aria | défaut sonner | **vérifier `role`/`aria-live="polite"`** |

### Périmètre — ce qui N'EST PAS dans cette story

- **Avertissement (bannière ambre)** : UX-DR13 mentionne un 4ᵉ type « avertissement », mais l'UX spec (ligne 829) précise que c'est une **bannière ambre en haut du formulaire** (champs manquants avant publication), PAS un toast. Ce composant relève de Story 4.3 (`CompletionIndicator`). Hors scope ici.
- **Toasts côté site public** : le système concerne le panel admin (`AdminLayout`). Le site public n'a pas de toasts en MVP.

### Architecture cible

`sonner` est le composant de toast retenu (c'est le toast officiel de l'écosystème shadcn/ui, cf. architecture « Composants UI : shadcn/ui »). On ne réinvente rien : on **configure** le `<Toaster>` et on **centralise** les appels via un helper `notify` pour garantir la cohérence (durées, persistance, couleurs) sur tous les futurs appels client (ex. erreurs d'upload en Story 4.4, copie de lien en 4.5).

### Helper cible — `inertia/lib/notify.ts`

```ts
import { toast } from 'sonner'

type ToastType = 'success' | 'error' | 'info'

export function toastOptionsFor(type: ToastType) {
  switch (type) {
    case 'error':
      return { duration: Infinity as const, closeButton: true }
    case 'success':
    case 'info':
    default:
      return { duration: 3000 }
  }
}

export const notify = {
  success: (message: string) => toast.success(message, toastOptionsFor('success')),
  error: (message: string) => toast.error(message, toastOptionsFor('error')),
  info: (message: string) => toast(message, toastOptionsFor('info')),
}
```

Si l'import de `sonner` dans `notify.ts` pose problème aux tests Japa (Node, pas de DOM), extraire `toastOptionsFor` dans `inertia/lib/notify_options.ts` (zéro import sonner) et l'importer des deux côtés. Tester `notify_options.ts`.

### Pattern flash serveur → toast (inchangé dans son principe)

Le backend continue de flasher via `session.flash('success'|'error', 'clé.i18n')` (cf. tous les contrôleurs Epic 2/3). Le `AdminLayout` reste le point unique qui lit ces flash et déclenche les toasts traduits. Cette story ne touche **aucun contrôleur** — uniquement la couche présentation.

### Notes sonner (à vérifier en implémentation)

- `visibleToasts` : prop du `<Toaster>`, défaut 3 — sonner empile et retire les plus anciens automatiquement (couvre AC4).
- `closeButton` : peut être global (`<Toaster closeButton />`) ou par toast (`{ closeButton: true }`). Pour AC2, le bouton Fermer doit au minimum être présent sur les erreurs persistantes.
- `richColors` : active les fonds colorés vert/rouge sémantiques (couvre succès vert / erreur rouge).
- **aria** : sonner rend chaque toast avec `aria-live` (`polite` pour les toasts non-critiques). Vérifier le DOM rendu ; si `role="status"` n'est pas posé nativement, voir si une option/wrapper est nécessaire pour satisfaire AC5 littéralement. Documenter le constat.

### Fichiers à créer

| Fichier | Description |
|---|---|
| `inertia/lib/notify.ts` | Helper centralisé (success/error/info) au-dessus de sonner |
| `inertia/lib/notify_options.ts` *(si besoin)* | Fonction pure `toastOptionsFor` isolée pour les tests |
| `tests/unit/lib/notify.spec.ts` | Tests unitaires des options de toast |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `inertia/layouts/AdminLayout.tsx` | `<Toaster>` config (bottom-right, visibleToasts, closeButton) + useEffect via `notify.*` |

### Anti-patterns à éviter

- **NE PAS** réintroduire un autre lib de toast — `sonner` est déjà la dépendance retenue
- **NE PAS** rendre `toast.success` persistant — seul le succès doit auto-disparaître (3 s)
- **NE PAS** utiliser `alert()` natif (règle UX spec ligne 832)
- **NE PAS** mettre la bannière « avertissement » (champs manquants) dans le système de toasts — c'est un composant de formulaire (Story 4.3)
- **NE PAS** dupliquer les options sonner à chaque appel — passer par `notify.*`
- **NE PAS** toucher aux contrôleurs ou au partage flash (`inertia_middleware`) — déjà en place

### Tests — patterns à suivre

- Tests unitaires de la fonction pure `toastOptionsFor` (pas de DOM requis) : `tests/unit/lib/`.
- Le rendu visuel et l'empilement sonner ne sont pas testables unitairement sans la suite `browser` (non configurée pour ce cas en MVP) → vérification manuelle notée en validation finale.
- Ne casser aucun des 178 tests existants.

### Dépendances cross-story

- **Stories 3.3–3.6** : flashent déjà `success`/`error` → bénéficieront immédiatement du nouveau style de toast.
- **Story 3.3 (review D3)** : le cas `flash.tempPassword` (toast persistant) doit être conservé.
- **Story 4.3+** : utiliseront `notify.*` côté client pour les erreurs d'upload, copie de lien, etc.

### Previous Story Intelligence

**Revue Epic 3 :**
- Le toast `tempPassword` persistant a été ajouté lors de la revue (D3) — `duration: Infinity, closeButton: true`. Le helper `notify.error` doit reproduire ce comportement.
- `AdminLayout` lit `flash.error`/`flash.success`/`flash.tempPassword` via `usePage<Data.SharedProps>().props.flash`.
- Le typage `Data.SharedProps` est inféré depuis `inertia_middleware` — ne pas casser.

**Gotchas :**
- `sonner` est une lib navigateur (DOM) — son import direct peut casser les tests Node/Japa. D'où l'extraction de la fonction pure pour les tests (Tâche 4.2).
- Les messages flash sont des **clés i18n** résolues côté client via `t(key, { defaultValue })` — le helper reçoit déjà le texte traduit, pas la clé.

### Project Structure Notes

- `inertia/lib/notify.ts` → à côté de `inertia/lib/utils.ts` (`cn`) existant.
- Tests dans `tests/unit/lib/` → nouveau sous-dossier, aligné avec `tests/unit/`.

### References

- [Source: epics.md#Story 4.1] — Acceptance criteria
- [Source: epics.md#UX-DR13] — 4 types de notifications, max 3, aria
- [Source: ux-design-specification.md:825-832] — Hiérarchie des notifications (succès/erreur/avertissement/info, position, durées, règle d'empilement)
- [Source: ux-design-specification.md:1114-1116] — Toast accessible `role="status" aria-live="polite"`
- [Source: architecture.md#Frontend et UI] — shadcn/ui (sonner) comme système de composants
- [Source: inertia/layouts/AdminLayout.tsx] — `<Toaster>` + useEffect flash→toast existants
- [Source: app/middleware/inertia_middleware.ts] — partage `flash: { error, success, tempPassword }`
- [Source: package.json] — `sonner@^2.0.7`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- **Aria (AC5)** : inspection de `node_modules/sonner/dist/index.mjs` → le conteneur sonner est rendu en `<section aria-label=... aria-live="polite" aria-relevant="additions text" aria-atomic="false">`. `aria-live="polite"` est donc **natif** ✅. En revanche `role="status"` n'est posé nulle part par sonner (ni section, ni `<li>`). Décision : NE PAS ajouter de wrapper `role="status"` — cela créerait une région live imbriquée (anti-pattern accessibilité, double annonce lecteur d'écran). `role="status"` a précisément `aria-live="polite"` comme sémantique ARIA implicite ; l'intention fonctionnelle d'UX-DR20 (annonce des toasts au lecteur d'écran) est donc pleinement satisfaite par l'`aria-live="polite"` natif. Déviation littérale documentée et assumée.
- **Tests inertia** : import direct de `inertia/lib/notify_options.ts` depuis un test serveur → erreur TS6305 (référence cross-projet TS) au typecheck, bien que l'exécution Japa fonctionne. Aligné sur la convention projet (lecture de source via `fs`), comme `tests/unit/layouts/admin_layout.spec.ts`.

### Completion Notes List

- **AC1 satisfait** : `notify.success` → toast vert 3s ; `<Toaster position="bottom-right">`.
- **AC2 satisfait** : `notify.error` → `{ duration: Infinity, closeButton: true }` (persistant + bouton Fermer) ; `<Toaster closeButton>`.
- **AC3 satisfait** : `notify.info` → `toast(message, { duration: 3000 })` neutre.
- **AC4 satisfait** : `visibleToasts={3}` (sonner empile max 3 et retire les plus anciens).
- **AC5 satisfait (fonctionnellement)** : `aria-live="polite"` natif sonner ; `role="status"` non ajouté pour éviter une région live imbriquée (cf. Debug Log).
- Système centralisé : `notify.*` est désormais le point d'entrée unique, prêt pour les appels client des Stories 4.3+ (erreurs upload, copie de lien).
- Aucun contrôleur ni le partage flash touchés. Tests : 185/185. Lint + typecheck verts.

### File List

**Créés :**
- `inertia/lib/notify_options.ts` — fonction pure `toastOptionsFor` (options par type, sans dépendance DOM)
- `inertia/lib/notify.ts` — helper `notify` (success/error/info) au-dessus de sonner
- `tests/unit/lib/notify.spec.ts` — 7 tests (options + wiring + config Toaster + routage flash)

**Modifiés :**
- `inertia/layouts/AdminLayout.tsx` — `<Toaster>` reconfiguré (bottom-right, closeButton, visibleToasts=3) + useEffect via `notify.*`

### Change Log

- 2026-06-01 : Implémentation Story 4.1 (Système de toasts admin, UX-DR13). Helper `notify` centralisé au-dessus de sonner (success 3s / error persistant+Fermer / info 3s), `<Toaster>` bas-droite + max 3, refactor du pont flash→toast. `aria-live="polite"` natif (role="status" documenté). 7 tests ajoutés. Tests totaux : 185/185.
