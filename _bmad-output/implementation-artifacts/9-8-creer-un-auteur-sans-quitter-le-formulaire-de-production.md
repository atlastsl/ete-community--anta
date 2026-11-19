---
baseline_commit: 49cbb80
---

# Story 9.8 : Créer un auteur sans quitter le formulaire de production

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**administrateur**,
je veux **créer un co-auteur absent du référentiel depuis le formulaire de production**,
afin de **ne pas perdre ma saisie et de le retrouver sélectionné automatiquement** (FR54, D16, D36, parcours 3).

## Décision de périmètre (lire en premier)

- **DANS 9.8** :
  - `POST /admin/authors/quick` (`admin.authors.quick-store`, groupe `middleware.admin()`) dans `admin/authors_controller.ts` : multipart, **JSON** 201 `{ author }` (forme `PickerAuthor` de la recherche 9.7) / 422 `{ errors: [{ field, message, rule }] }` ; même chaîne que `store` (validateur, `assertAffiliationRule({ isMigrated: false })`, photo par `ImageService`, `AuthorService.create`, journal `create` + `consent_confirm`, suppression du fichier temporaire multipart) ;
  - `inertia/components/admin/AuthorFormDialog.tsx` (nouveau) : `Dialog` shadcn `max-w-lg` réutilisant `AuthorForm` + `inertia/lib/author_form.ts` (`validateAuthorForm`, `toAuthorPayload`), envoi `fetch` multipart avec `X-XSRF-TOKEN` et `Accept: application/json` ;
  - `AuthorCombobox.tsx` : dernière option « Créer un auteur « {saisie} » » (toujours présente quand la liste est ouverte), bouton outline « Créer un auteur » à côté du champ, ouverture du dialog préremplie (D36), auteur créé ajouté par `onSelect` (fin de sélection), saisie vidée, focus rendu ;
  - helpers client `splitAuthorQuery` (`author_form.ts`), `toAuthorFormData` (FormData multipart) et `xsrfToken` (`inertia/lib/xsrf.ts`) ;
  - i18n admin FR/EN `authors.dialog.*`, `authors.picker.create_option` ;
  - tests fonctionnels `tests/functional/admin/authors_quick.spec.ts`, tests par lecture de source `tests/unit/components/author_form_dialog.spec.ts`.
- **HORS 9.8 (ne PAS implémenter)** :
  - toute migration, toute nouvelle dépendance npm (le `Dialog` shadcn existe déjà dans `inertia/components/ui/dialog.tsx`, pas de CLI shadcn) ;
  - surlignage `<mark>` des correspondances (reporté en 9.7) ; détection de doublons à la création (aucune exigence) ;
  - barre de progression d'envoi de la photo dans le dialog (`fetch` n'expose pas la progression ; photo ≤ 5 Mo) ;
  - limite multipart par route (report 9.3) ; suite de tests transverse → **9.9**.

## Acceptance Criteria

1. **Option et bouton** — **Given** `AuthorCombobox` avec une saisie d'au moins 2 caractères, **When** la liste s'ouvre, **Then** la dernière option (`role="option"`, icône `Plus`, couleur primaire) est toujours « Créer un auteur « {saisie} » » (aussi pendant le chargement, sans résultat ou après une erreur), atteignable par ↑ ↓ et activable par Entrée ou clic **and** un bouton outline « Créer un auteur » (`type="button"`, ne soumet jamais la production) est disponible à côté du champ.
2. **Préremplissage (D36)** — **Given** l'option ou le bouton activé, **When** `AuthorFormDialog` s'ouvre, **Then** il reprend les champs d'`AuthorForm` (Nom(s)*, Prénom(s)*, affiliations répétables avec ≥ 1 requise, Google Scholar, photo, case de consentement facultative désactivée sans affiliation, D16/D27), titre « Créer un auteur », description « L'auteur créé sera ajouté à la production. », prérempli par la saisie (espaces réduits) découpée au dernier espace : avant = prénom(s), dernier mot = nom ; un seul mot = nom ; saisie vide = champs vides.
3. **Focus** — **Given** le dialog ouvert, **Then** le focus y est piégé (Radix) ; Échap, « Annuler » ou le bouton Fermer le ferment sans créer et rendent le focus au déclencheur (champ de recherche pour l'option, bouton pour le bouton) ; un clic à l'extérieur ne ferme pas (saisie protégée) ; pendant l'envoi, aucune fermeture.
4. **Création** — **Given** une saisie valide, **When** l'administrateur clique « Créer et ajouter », **Then** une requête `fetch` multipart vers `urlFor('admin.authors.quick-store')` (en-têtes `X-XSRF-TOKEN` lu du cookie `XSRF-TOKEN`, `Accept: application/json`, `credentials: 'same-origin'`) renvoie 201 `{ author }` **and** le dialog se ferme, l'auteur est ajouté en fin de sélection, la saisie du combobox est vidée, le focus revient au champ de `AuthorCombobox`, toast « Auteur créé. » et annonce polie « {nom} créé et ajouté aux auteurs. » **and** les saisies non enregistrées de la production sont intactes (aucune navigation Inertia, aucun `router.*`, l'événement `submit` du dialog ne remonte pas au formulaire de production) **and** le journal reçoit `create` / `author` (`metadata.name`) et `consent_confirm` si la case est cochée.
5. **Erreurs** — **Given** une saisie invalide, **When** l'envoi est tenté, **Then** la validation client (`validateAuthorForm`) bloque l'envoi avec les erreurs en ligne ; côté serveur l'endpoint renvoie 422 avec les erreurs VineJS en JSON (`{ errors: [{ field, message, rule }] }`, messages = clés i18n), affichées en ligne sous les champs ; le dialog reste ouvert ; le bouton est désactivé avec `Loader2` pendant l'envoi ; toute autre réponse (403, 500, session expirée, réseau) → message d'erreur générique `role="alert"` dans le dialog, rien n'est ajouté.
6. **CSRF (NFR7)** — **Given** une requête sans jeton XSRF/CSRF valide, **When** elle atteint `POST /admin/authors/quick`, **Then** Shield la rejette et aucune fiche n'est créée ; non authentifié → redirection `/admin/login`, rien créé.
7. **Photo** — **Given** une photo JPEG/PNG/WebP ≤ 5 Mo, **Then** elle est traitée comme en 9.3 (variantes, `photo_key`) ; image refusée → 422 `photo` (`authors.form.errors.photo_*`) ; fichier temporaire multipart supprimé après chaque requête.
8. **Non-régression** — suite complète `npm run test:local`, lint, typecheck, build verts ; `package.json` inchangé ; `.adonisjs/*` régénérés (`/tmp/d37/gen.sh`) et commités.

## Tasks / Subtasks

- [x] **T1 — Endpoint** (AC 4–7)
  - [x] 1.1 Route `router.post('authors/quick', [controllers.admin.Authors, 'quickStore']).as('admin.authors.quick-store')` (avant les routes `authors/:id`).
  - [x] 1.2 Extraire de `storeAuthor` un `createAuthor(ctx)` partagé (validation, règle d'affiliation, photo, création, journal) ; `store` garde flash + redirection.
  - [x] 1.3 `quickStore` : `try { createAuthor → load('affiliations') → toPickerAuthors → response.created({ author }) } catch (E_VALIDATION_ERROR) { 422 { errors } } finally { discardUpload }`.
- [x] **T2 — Lib client** (AC 2, 4)
  - [x] 2.1 `splitAuthorQuery(query)` dans `author_form.ts` (D36) ; `toAuthorFormData(payload)` (FormData : `affiliations[i][institution]`, booléens `'1'`).
  - [x] 2.2 `inertia/lib/xsrf.ts` : `xsrfToken()` (cookie `XSRF-TOKEN`, `decodeURIComponent`).
- [x] **T3 — `AuthorFormDialog.tsx`** (AC 2–5) : état local `AuthorFormData`, `AuthorForm requireAffiliation`, validation client, `fetch`, 201/422/autres, `Loader2`, fermeture bloquée pendant l'envoi, `onInteractOutside` neutralisé, `onCloseAutoFocus` → cible de retour, `event.stopPropagation()` sur `submit`, défilement `max-h` du contenu.
- [x] **T4 — `AuthorCombobox.tsx`** (AC 1, 3, 4) : option de création (index `results.length`), navigation sur `results.length + 1`, Entrée/clic, bouton outline, dialog monté dans le combobox, retour de focus, `onSelect(author)` + saisie vidée + annonce.
- [x] **T5 — i18n FR/EN** : `authors.picker.create_option`, `authors.dialog.{description,submit,close,added,error,session_expired}` ; titre = `authors.create_button` réutilisé (pas de clé `authors.dialog.title`) ; réutiliser aussi, `authors.flash.created`, `actions.cancel`.
- [x] **T6 — Tests** (AC 1–7)
  - [x] 6.1 `tests/functional/admin/authors_quick.spec.ts` : 201 (forme `{ author }`, affiliations ordonnées, journal `create`), consentement (`isPublic`, `consent_confirm`), 422 JSON (noms manquants, sans affiliation, consentement sans affiliation, Scholar invalide), CSRF refusé, non authentifié, photo (variantes) et photo refusée (422 `photo`), rien créé en cas d'échec.
  - [x] 6.2 `tests/unit/components/author_form_dialog.spec.ts` (lecture de source) : `role="dialog"`, `AuthorForm`, `fetch` + en-têtes, `urlFor('admin.authors.quick-store')`, aucun `router`, `stopPropagation`, `onCloseAutoFocus`, `Loader2`, option de création dernière, bouton `type="button"`, D36, i18n FR/EN.
  - [x] 6.3 Étendre le test de clés i18n (`authors_index_page.spec.ts`) au dialog et au combobox.
- [x] **T7 — Finitions** (AC 8) : `/tmp/d37/gen.sh`, lint, typecheck, build, suite complète ; story → `review`.

### Review Findings

Revue de code du 2026-11-18 (couches adversariale, cas limites, conformité aux AC), constats vérifiés avant correction.

- [x] [Review][Patch] Surlignage de « Créer un auteur » volé à l'arrivée des résultats (option choisie au clavier pendant le chargement → Entrée ajoutait un auteur existant) ; après une erreur, ↓ perdait le surlignage au nouvel essai [AuthorCombobox.tsx] — `createActive` (ref synchronisée par un effet déclaré avant la recherche) : surlignage conservé (`found.length`, ou 0 sans résultat / après erreur) ; Entrée sur « Créer » ouvre sans relancer la recherche.
- [x] [Review][Patch] Session expirée ou jeton CSRF refusé (redirection opaque, 0, 401, 403, 419) affichés comme une panne générique [AuthorFormDialog.tsx] — message dédié `authors.dialog.session_expired` (FR/EN) ; 5xx et erreur réseau gardent le message générique.
- [x] [Review][Patch] 422 sur une clé sans champ affiché (`affiliations.0`, `removePhoto`) silencieux [AuthorFormDialog.tsx] — alerte générique en plus (`DISPLAYED_ERROR`).
- [x] [Review][Patch] Focus initial sur × [AuthorFormDialog.tsx] — `onOpenAutoFocus` → premier champ (Nom(s)).
- [x] [Review][Patch] Ouvrir la fenêtre depuis le champ marquait « Auteurs » touché (erreur « au moins un auteur » derrière la fenêtre) [AuthorCombobox.tsx] — `openingCreate` : ce blur n'appelle pas `onBlur`.
- [x] [Review][Patch] Toast et annonce émis pendant que Radix masque la page (`aria-hidden`) [AuthorCombobox.tsx, AuthorFormDialog.tsx] — émis après fermeture (`onClosed` depuis `onCloseAutoFocus`, tâche suivante).
- [x] [Review][Patch] Échec après le commit (préchargement / sérialisation) → 500 alors que la fiche existe (recréée au nouvel essai) [authors_controller.ts] — `quickAuthor` : repli 201 minimal (affiliations soumises, sans photo), erreur journalisée ; test.
- [x] [Review][Patch] Mise en page mobile [AuthorCombobox.tsx] — `flex flex-col gap-2 sm:flex-row sm:items-start`.
- [x] [Review][Patch] Tests : fichier temporaire multipart supprimé après 201 et après 422 photo (AC 7) ; assertions de source ciblées (`stopPropagation` dans `handleSubmit`, `<li>` de création hors de toute condition) ; `role="dialog"` redondant retiré (posé par Radix) ; test « parcours navigateur » avec la valeur décodée `e:…` comme `xsrfToken()` ; motif `DISPLAYED_ERROR` testé sur des cas réels ; test 9.7 « nouvelle saisie » aligné (seule « Créer » garde son surlignage).
- [x] [Review][Defer] Fichiers temporaires multipart laissés quand Shield ou l'authentification refusent la requête avant le contrôleur — préexistant, toutes les routes multipart.
- [x] [Review][Defer] Clé d'idempotence pour `quick-store` (double envoi après une perte de réseau).
- [x] [Review][Defer] Avertissement d'homonyme avant création — question PO.

Écartés : `consent` cité parmi les clés 422 non affichées (faux : `AuthorForm` affiche `consent-error` sous la case ; gardé dans les champs affichés) ; « 11 tests et non 10 » (les notes indiquaient déjà 11 fonctionnels ; « 8/10 » du journal décrit le premier passage rouge) ; déplacement des helpers purs hors d'`inertia/` (aucun module partagé existant dans le projet : non fait, testés par lecture de source).

## Dev Notes

### Existant à réutiliser (ne pas réinventer)

- `app/controllers/admin/authors_controller.ts` : `storeAuthor` (validation `authorValidator`, `affiliationsOf` — `[]` seulement en multipart —, `assertAffiliationRule`, `photoVariants`, `AuthorService.create`, journal `create` puis `logConsent(CONSENT_CONFIRM)`), `discardUpload` (le bodyparser ne supprime jamais ses fichiers temporaires : appel dans `finally`), `search` (forme JSON). `AuthorService.toPickerAuthors` exige `affiliations` préchargées (relation triée par `position`).
- `AuthorService.create` revérifie D27 (consentement sans affiliation → `consentRequiresAffiliationError`) et relance sur conflit de slug ; il envoie la photo avant l'INSERT et la retire en cas d'échec.
- `AuthorForm` (props `data`, `setData`, `errors`, `requireAffiliation`) : sans `onWithdrawConsent` aucun bouton de retrait (prévu pour 9.8) ; il focalise le premier champ invalide à chaque nouvel objet `errors`, décoche le consentement devenu indisponible, gère l'aperçu photo (URL objet révoquée).
- `inertia/lib/author_form.ts` : `EMPTY_AUTHOR_FORM`, `validateAuthorForm(data, { requireAffiliation: true })`, `toAuthorPayload` (valeurs nettoyées, `consent` seulement si disponible).
- `AuthorCombobox` (9.7) : ARIA 1.2 écrit à la main, région `role="status"` toujours montée, `mousedown` neutralisé sur le popup, options effacées dès qu'un terme change, Entrée ignorée pendant le chargement pour les résultats. `ProductionForm.authorsField` lui passe `onSelect` (ajout en fin, sans doublon) et `inputRef`.
- `notify.success` (`inertia/lib/notify.ts`) pour le toast (sonner, région live).
- `Dialog` shadcn (`inertia/components/ui/dialog.tsx`, méta-paquet `radix-ui`).

### Pièges (leçons 9.1–9.7, obligatoires)

- **Portail React** : le dialog est rendu dans `document.body`, mais les événements synthétiques remontent l'arbre React → un `submit` du formulaire du dialog atteindrait `<form onSubmit>` de `Create.tsx` / `Edit.tsx` (enregistrement de la production !) : `event.preventDefault()` **et** `event.stopPropagation()`.
- Tous les boutons du combobox et du dialog hors « Créer et ajouter » sont `type="button"`.
- Shield : `enableXsrfCookie: true` ; le cookie `XSRF-TOKEN` est lisible en JS (encodé URI) ; Shield accepte l'en-tête `X-XSRF-TOKEN`. Tests : `.withCsrfToken()`, `.redirects(0)`, `loginAs()`.
- Multipart : un tableau vide n'émet aucun champ → `affiliations` absent = `[]` (multipart seulement) → `affiliation_required`. Toujours envoyer en multipart.
- Erreurs 422 : capturer `vineErrors.E_VALIDATION_ERROR` dans le contrôleur et répondre explicitement `response.unprocessableEntity({ errors: error.messages })` (ne pas dépendre de la négociation de contenu du gestionnaire d'exceptions / Inertia).
- Journal après le commit (`ActivityLogService.log` hors transaction, ne lève jamais).
- Frontière TS6305 : rien sous `inertia/` n'est importé par les tests ; lecture de source uniquement.
- Annonces : la même phrase deux fois de suite n'est pas relue → alterner un NBSP (patron `AuthorForm`) ou remonter le nœud.
- Pas de CLI shadcn (elle a déjà ajouté une fausse dépendance `cn`) ; vérifier `package.json`.
- Noms fictifs uniquement dans les tests (dépôt public).

### Décisions par défaut (D-9.8-x)

- **a** Réponse 201 `{ author }` = forme `PickerAuthor` (identique à `search`), directement ajoutable à la sélection.
- **b** Le bouton « Créer un auteur » préremplit aussi avec la saisie courante (vide → champs vides).
- **c** L'option de création est présente dès que la liste est ouverte (≥ 2 caractères), y compris pendant le chargement et après une erreur ; pendant le chargement l'option active reste -1 (Entrée sans effet tant que l'admin n'a pas choisi l'option au clavier).
- **d** Clic extérieur sans effet et fermeture bloquée pendant l'envoi (évite une fiche créée mais non ajoutée).
- **e** Pas de barre de progression (photo ≤ 5 Mo, `fetch`).
- **f** Session expirée / redirection : `redirect: 'manual'` → message générique (rien n'est ajouté ; la saisie du dialog reste).

### Fichiers

- UPDATE : `start/routes.ts`, `app/controllers/admin/authors_controller.ts`, `inertia/components/admin/AuthorCombobox.tsx`, `inertia/lib/author_form.ts`, `inertia/locales/admin/{fr,en}.json`, `tests/unit/components/authors_index_page.spec.ts`, `.adonisjs/*` (régénérés).
- NEW : `inertia/components/admin/AuthorFormDialog.tsx`, `inertia/lib/xsrf.ts`, `tests/functional/admin/authors_quick.spec.ts`, `tests/unit/components/author_form_dialog.spec.ts`.

### Références

- epics.md « Story 9.8 » ; architecture.md P2.6 (route `admin.authors.quick-store`, fenêtre « Créer un auteur »), P2-14 ; EXPERIENCE.md (AuthorCombobox, AuthorForm, flux 2 / parcours 3, libellés) ; DESIGN.md (AuthorCombobox, AuthorFormDialog) ; maquette `mockups/admin-author-picker.html` (dialog `max-w-lg`, « Créer et ajouter », « Annuler »).

## Questions ouvertes (non bloquantes, défauts retenus)

- Faut-il prévenir d'un homonyme probable avant de créer (recherche déjà affichée dans la liste) ? Défaut : non.
- Clic extérieur : ignoré (D-9.8-d) — à confirmer en recette.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Tests fonctionnels écrits d'abord (8/10 en échec avant la route, 404) puis verts.
- Shield : un jeton absent ou invalide donne une redirection 302 vers la page précédente (aucune fiche créée) ; côté client `redirect: 'manual'` → message générique.
- Le client de test ne conserve pas la session entre deux requêtes : le test « parcours navigateur » partage un secret `csrf-secret` fictif par `withSession` entre la page (cookie `XSRF-TOKEN`) et l'envoi (`X-XSRF-TOKEN` = `encodeURIComponent('e:' + chiffré)`, comme le cookie lu par le navigateur).
- Test de source 9.7 « région d'état avant le popup » : région `role="status"` placée juste sous le libellé ; test de clés i18n étendu au dialog et au combobox, avec résolution des pluriels i18next (`key` → `key_other`).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `POST /admin/authors/quick` (`admin.authors.quick-store`) : `createAuthor(ctx)` extrait de `storeAuthor` (validation, règle d'affiliation, photo, `AuthorService.create`, journal `create` + `consent_confirm`), partagé par `store` (flash + redirection) et `quickStore` (201 `{ author }` forme `PickerAuthor`, 422 `{ errors }` explicite quel que soit `Accept`, fichier temporaire supprimé dans `finally`).
- `AuthorFormDialog` : `Dialog` shadcn (`role="dialog"`, `sm:max-w-lg`, défilement), `AuthorForm requireAffiliation`, préremplissage D36 (`splitAuthorQuery`), validation client, `fetch` multipart (`toAuthorFormData`, `X-XSRF-TOKEN` via `xsrfToken()`, `Accept: application/json`, `redirect: 'manual'`), erreurs 422 en ligne (focus sur le premier champ invalide par `AuthorForm`), échec générique `role="alert"`, `Loader2` + bouton désactivé, double envoi bloqué, fermeture impossible pendant l'envoi, clic extérieur ignoré, `submit` stoppé (portail React), focus rendu par `onCloseAutoFocus`.
- `AuthorCombobox` : option « Créer un auteur « {saisie} » » toujours dernière (index `results.length`, ↑ ↓ / Entrée / clic ; active par défaut quand aucun résultat), bouton outline « Créer un auteur » `type="button"`, dialog monté dans le combobox ; après création : `onSelect` (fin de sélection, sans doublon via `ProductionForm`), saisie vidée, focus au champ, toast « Auteur créé. », annonce « {nom} créé et ajouté aux auteurs. » ; Annuler/Échap → focus au déclencheur.
- i18n FR/EN : `authors.picker.create_option`, `authors.dialog.{description,submit,close,added,error}` (titre = `authors.create_button`, toast = `authors.flash.created`, `actions.cancel`).
- Tests : 11 fonctionnels (`authors_quick.spec.ts`), 14 par lecture de source (`author_form_dialog.spec.ts`) ; suite complète 790 verts (base 765) ; après revue : 12 fonctionnels, 19 par lecture de source, suite 796 verts, lint, typecheck, build verts ; `package.json` inchangé ; `.adonisjs/*` régénérés.

### File List

- `start/routes.ts`
- `app/controllers/admin/authors_controller.ts`
- `inertia/components/admin/AuthorFormDialog.tsx` (nouveau)
- `inertia/components/admin/AuthorCombobox.tsx`
- `inertia/lib/author_form.ts`
- `inertia/lib/xsrf.ts` (nouveau)
- `inertia/locales/admin/fr.json`
- `inertia/locales/admin/en.json`
- `tests/functional/admin/authors_quick.spec.ts` (nouveau)
- `tests/unit/components/author_form_dialog.spec.ts` (nouveau)
- `tests/unit/components/authors_index_page.spec.ts`
- `_bmad-output/implementation-artifacts/9-8-creer-un-auteur-sans-quitter-le-formulaire-de-production.md`
- `_bmad-output/implementation-artifacts/deferred-work.md` (revue)
- `tests/unit/components/author_picker.spec.ts` (revue)
- `.adonisjs/client/registry/index.ts`, `.adonisjs/client/registry/schema.d.ts`, `.adonisjs/client/registry/tree.d.ts`, `.adonisjs/server/routes.d.ts` (régénérés)

## Change Log

- 2026-11-18 : création de la story (contexte complet).
- 2026-11-18 : implémentation (endpoint JSON `quick-store`, `AuthorFormDialog`, option et bouton de création dans `AuthorCombobox`, i18n, 25 tests) → `review`.
- 2026-11-18 : revue de code — 9 correctifs (surlignage « Créer », session expirée, 422 hors champ, focus initial, blur, annonces après fermeture, repli 201 après commit, mobile, tests), 3 reports → `done`.
