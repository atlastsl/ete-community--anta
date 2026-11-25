---
baseline_commit: 840c6bf
---

# Story 9.4 : Confirmer et retirer le consentement d'un auteur

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**administrateur** (rôle `admin` ou `super_admin`),
je veux **confirmer le consentement d'un auteur à la publication de son profil, ou le retirer**,
afin que **seuls les profils consentis deviennent publics, avec une trace de chaque décision** (FR53, D16, D17, D27).

## Décision de périmètre (lire en premier)

- **DANS 9.4** :
  - `ActionType.CONSENT_CONFIRM` / `CONSENT_WITHDRAW` (filtre du Journal automatique, libellés i18n) — **pas** `FEATURED_UPDATE` / `FEATURED_AUTO_REMOVE` (Epic 11) ;
  - champ `consent` (booléen facultatif) dans `author_validator.ts`, `AuthorForm` (case D16 dans l'encadré de consentement), `Create` / `Edit` ;
  - règle D27 au validateur (`assertAffiliationRule` étendu) **et** au service (vérification sur la ligne verrouillée) ; une fiche publique garde ≥ 1 affiliation (P2.1, `minLength(1)` même pour une fiche migrée) ;
  - routes `POST /admin/authors/:id/confirm-consent` (`admin.authors.confirm-consent`) et `POST /admin/authors/:id/withdraw-consent` (`admin.authors.withdraw-consent`), idempotentes ;
  - actions « Confirmer le consentement » / « Retirer le consentement » dans la liste (dialog de confirmation) ; dans la fiche, case (non public) ou badge « Public » + bouton « Retirer le consentement » (public) ;
  - journal `consent_confirm` / `consent_withdraw` (`resourceType: 'author'`, `metadata: { name }`) ; i18n `authors.consent.*`, `activity.action.consent_*` ; tests.
- **HORS 9.4 (ne PAS implémenter)** :
  - effets publics (liste `/authors`, profil `/authors/:slug`, 404 après retrait, noms cliquables, `/media` des photos d'auteurs, plan du site) → **Epic 10** ;
  - `RankingService.invalidate()` sur confirmation / retrait (architecture P2.3) → **Epic 12** (le service n'existe pas : ne pas le créer) ;
  - conversion des auteurs (fiches migrées sans consentement) → **9.5 / 9.6** ; `GET /admin/authors/search` (`isPublic`) → **9.7** ; `AuthorFormDialog` / `quick-store` → **9.8** (mais la case de consentement vit dans `AuthorForm`, pilotée par props, pour y être réutilisée telle quelle) ;
  - aucune migration : `authors.consent_confirmed_at` (timestamp NULL) et `consent_confirmed_by_id` (FK `admin_users` `SET NULL`) existent depuis 9.1 ; `admin_activity_logs.action_type` est un `varchar` sans CHECK ni enum Postgres (vérifié : `1775918737632_create_admin_activity_logs_table.ts`, `table.string('action_type')`) → les nouvelles valeurs ne demandent aucun DDL.

## Acceptance Criteria

1. **Types de journal** — **Given** `app/enums/action_type.ts`, **When** la story est livrée, **Then** il contient `CONSENT_CONFIRM: 'consent_confirm'` et `CONSENT_WITHDRAW: 'consent_withdraw'`, exposés automatiquement par le filtre de la page Journal (`Object.values(ActionType)`, `actionTypes` passe de 7 à 9 valeurs) et traduits (`activity.action.consent_confirm` « Consentement confirmé » / « Consent confirmed », `activity.action.consent_withdraw` « Consentement retiré » / « Consent withdrawn ») ; la colonne Ressource affiche « Auteur — {nom} » (mécanisme `metadata.name` de 9.1, inchangé).
2. **Case facultative (D16, D27)** — **Given** `AuthorForm` en création ou sur une fiche non publique, **When** il s'affiche, **Then** une case **facultative**, décochée par défaut, « L'auteur a consenti à la publication de son profil. » est présente dans l'encadré de consentement (`rounded-md border border-stone-200 bg-stone-50 p-3`, case `accent-green-700`) avec l'aide D16 reliée par `aria-describedby` ; la fiche est enregistrable sans elle (non publique) **and** la case est désactivée (et affichée décochée) tant que le formulaire ne contient aucune affiliation dont l'institution est saisie, avec le texte visible « Complétez d'abord une affiliation. » relié à la case ; elle se réactive dès qu'une institution est saisie ; une case cochée puis rendue indisponible n'envoie pas `consent`.
3. **Confirmation par la case** — **Given** la case cochée (création ou modification d'une fiche non publique), **When** la fiche est enregistrée, **Then** `consent_confirmed_at` (= maintenant) et `consent_confirmed_by_id` (= l'admin connecté) sont renseignés dans la **même transaction** que l'enregistrement, et une entrée `consent_confirm` / `author` (`metadata: { name }`) est journalisée **après** l'entrée `create` / `update` (après le commit) ; une modification qui ne change que le consentement journalise `consent_confirm` seul (pas d'`update` sans champ modifié) ; `consent` envoyé sur une fiche déjà publique → aucun changement de consentement, aucune entrée `consent_confirm`.
4. **Confirmation depuis la liste** — **Given** une fiche non publique avec au moins une affiliation, dans la liste admin, **When** l'administrateur choisit « Confirmer le consentement » et valide le dialog « Le profil de {nom} deviendra public. », **Then** `POST /admin/authors/:id/confirm-consent` confirme le consentement (`consent_confirmed_at`, `consent_confirmed_by_id`), flash « Consentement confirmé. », retour à la page d'origine (`redirect().back()` : liste filtrée/paginée conservée), le badge passe à « Public », journal `consent_confirm` **and** sur une fiche sans affiliation l'action est `aria-disabled` (focusable, `opacity-50`) avec l'infobulle « Complétez d'abord une affiliation. » au survol **et** au focus, reliée par `aria-describedby` (patron du bouton Supprimer de 9.2) **and** un appel direct sur une fiche sans affiliation est refusé (flash d'erreur « Confirmation impossible : complétez d'abord une affiliation. », aucun changement, aucun journal) — D27 vérifié **au service** sur la ligne verrouillée.
5. **Retrait (D17)** — **Given** une fiche à profil public (fiche ou liste), **When** l'administrateur choisit « Retirer le consentement » et valide le dialog « Le profil de {nom} ne sera plus public. Ses productions restent publiées, son nom s'affichera sans lien. », **Then** `POST /admin/authors/:id/withdraw-consent` remet `consent_confirmed_at` et `consent_confirmed_by_id` à NULL, flash « Consentement retiré. », le badge passe à « Non public », journal `consent_withdraw` **and** dans la fiche d'un profil public la case est remplacée par le badge « Public » + le bouton « Retirer le consentement » (même dialog) ; après le retrait, la fiche réaffiche la case (décochée) sans perdre les saisies non enregistrées du formulaire.
6. **Affiliations d'une fiche publique** — **Given** une fiche au consentement confirmé (migrée ou non), **When** l'administrateur tente d'enregistrer 0 affiliation, **Then** le validateur refuse (`affiliations` : `authors.form.errors.affiliation_required`, P2.1) — côté client aussi (`requireAffiliation` vrai, dernier × désactivé) — et le service refuse de même si la fiche est devenue publique entre-temps (ligne verrouillée).
7. **Idempotence** — **Given** une confirmation sur un profil déjà public ou un retrait sur un profil non public, **When** la route est appelée, **Then** aucun changement (ni `consent_confirmed_*`, ni `updated_at`) ni entrée de journal n'est produit ; redirection arrière sans flash d'erreur.
8. **Accès** — les deux routes sont dans le groupe `middleware.admin()` (admin et super admin, P2-15), nommées, appelées par `urlFor` ; non authentifié → `/admin/login` ; id malformé ou inconnu → 404 (garde UUID existante `findOrFail`).
9. **Non-régression et i18n** — création / modification sans `consent` se comportent exactement comme en 9.1–9.3 (y compris multipart avec photo et fiche migrée sans affiliation) ; la page Journal, la liste et ses filtres (dont « Consentement en attente ») restent conformes ; toutes les chaînes dans `inertia/locales/admin/{fr,en}.json`, parité vérifiée par `tests/unit/i18n/translations.spec.ts` ; suite complète, lint, typecheck et build verts.

## Tasks / Subtasks

- [x] **T1 — Journal** (AC 1)
  - [x] 1.1 `app/enums/action_type.ts` : ajouter `CONSENT_CONFIRM: 'consent_confirm'`, `CONSENT_WITHDRAW: 'consent_withdraw'` (après `PASSWORD_RESET`).
  - [x] 1.2 i18n `activity.action.consent_confirm` / `consent_withdraw` (FR/EN). Rien à changer dans `activity_logs_controller.ts` ni `ActivityLogs/Index.tsx` (filtre et badge déjà génériques).
  - [x] 1.3 Tests : `tests/functional/admin/activity_logs.spec.ts` (`assert.lengthOf(props.actionTypes, 7)` → 9, + filtre `?actionType=consent_confirm` accepté) ; `tests/unit/services/activity_log_service.spec.ts` (liste des types valides complétée).
- [x] **T2 — Validateur** (AC 2, 3, 6)
  - [x] 2.1 `author_validator.ts` : `consent: vine.boolean().optional()` (JSON `true/false`, FormData `'1'/'0'`). Pas de message dédié (même choix que `removePhoto`).
  - [x] 2.2 Étendre `assertAffiliationRule(data: { affiliations: unknown[]; consent?: boolean }, options: { isMigrated: boolean; isPublic?: boolean })` : erreurs cumulées dans un seul `E_VALIDATION_ERROR` :
    - `affiliations` vide **et** (`!isMigrated` **ou** `isPublic`) → `{ field: 'affiliations', message: 'authors.form.errors.affiliation_required', rule: 'minLength' }` (comportement 9.1 inchangé quand `isPublic` est absent) ;
    - `consent === true` **et** `affiliations` vide → `{ field: 'consent', message: 'authors.form.errors.consent_requires_affiliation', rule: 'consent' }` (D27).
  - [x] 2.3 Exporter un petit helper `affiliationRequiredError()` (même message, champ `affiliations`) réutilisé par le service (T3.3) pour ne pas dupliquer la clé.
- [x] **T3 — `AuthorService`** (AC 3, 4, 5, 6, 7)
  - [x] 3.1 `AuthorPayload` + `consent?: boolean`.
  - [x] 3.2 `create(payload, adminId, photo?)` : dans `createOnce`, si `payload.consent === true` (le contrôleur a déjà vérifié ≥ 1 affiliation) → `author.consentConfirmedAt = DateTime.now()`, `author.consentConfirmedById = adminId`. Le résultat expose si le consentement a été confirmé : `author.consentConfirmedAt !== null` suffit (pas de changement de type de retour).
  - [x] 3.3 `update(author, payload, options)` : `AuthorPhotoOptions` → `AuthorUpdateOptions = { photo?, removePhoto?, adminId?: string | null }` (garder l'alias exporté `AuthorPhotoOptions` si des tests l'importent — vérifier par `grep`). Retour `{ author, fields, consentConfirmed: boolean }`. Calcul : `wantsConsent = payload.consent === true && author.consentConfirmedAt === null` ; retour anticipé seulement si `fields.length === 0 && !wantsConsent`. Dans la transaction, sur la ligne verrouillée (`locked`) : `const affiliationsAfter = fields.includes('affiliations') ? payload.affiliations.length : <nombre actuel>` (`author.affiliations.length`, déjà chargé) ; si (`locked.consentConfirmedAt !== null` **ou** `wantsConsent`) et `affiliationsAfter === 0` → `throw affiliationRequiredError()` (la transaction est annulée ; la compensation photo existante s'applique) ; si `wantsConsent && locked.consentConfirmedAt === null` → poser `consentConfirmedAt`/`consentConfirmedById` sur `author`, `consentConfirmed = true`. `consent` n'entre **jamais** dans `fields` (entrée de journal séparée). `updatedAt` explicite inchangé.
  - [x] 3.4 Nouveau `static async confirmConsent(author, adminId): Promise<'confirmed' | 'unchanged' | 'no_affiliation'>` : transaction, `Author.query({ client: trx }).where('id', author.id).forUpdate().firstOrFail()` ; déjà public → `'unchanged'` ; `AuthorAffiliation.query({ client: trx }).where('authorId', author.id).count` = 0 → `'no_affiliation'` ; sinon `locked.useTransaction(trx)`, poser les deux colonnes, `save()` → `'confirmed'` (rafraîchir l'instance passée : `author.consentConfirmedAt = locked.consentConfirmedAt` etc., ou utiliser `author` directement après le verrou comme `update`).
  - [x] 3.5 Nouveau `static async withdrawConsent(author): Promise<'withdrawn' | 'unchanged'>` : même verrou ; non public → `'unchanged'` ; sinon les deux colonnes à `null`, `save()` → `'withdrawn'`.
  - [x] 3.6 Docblocks anglais ; pas de journalisation dans le service (le contrôleur journalise après le commit, convention 9.1).
- [x] **T4 — Contrôleur et routes** (AC 3, 4, 5, 7, 8)
  - [x] 4.1 `storeAuthor` : `assertAffiliationRule(data, { isMigrated: false })` (couvre `consent` sans affiliation) ; après `create` et le journal `create`, si `author.consentConfirmedAt` → `ActivityLogService.log({ actionType: ActionType.CONSENT_CONFIRM, resourceType: 'author', resourceId, metadata: { name } })`.
  - [x] 4.2 `updateAuthor` : `assertAffiliationRule(data, { isMigrated: author.migrationKey !== null, isPublic: author.consentConfirmedAt !== null })` ; `AuthorService.update(author, data, { photo, removePhoto, adminId: auth.user!.id })` ; journal `update` si `fields.length > 0` (inchangé) **puis** `consent_confirm` si `consentConfirmed`.
  - [x] 4.3 `edit` : props `isPublic: author.consentConfirmedAt !== null`, `isIncomplete: author.affiliations.length === 0` (badges de la fiche).
  - [x] 4.4 `confirmConsent({ params, auth, response, session })` : `findOrFail` (garde UUID) ; `confirmed` → journal `consent_confirm` `{ name }` + flash `success` `authors.consent.flash.confirmed` ; `no_affiliation` → flash `error` `authors.consent.flash.refused` ; `unchanged` → rien ; toujours `response.redirect().back()`.
  - [x] 4.5 `withdrawConsent` : idem avec `consent_withdraw`, flash `authors.consent.flash.withdrawn`.
  - [x] 4.6 `start/routes.ts` (groupe `middleware.admin()`, à côté des routes auteurs) :
    `router.post('authors/:id/confirm-consent', [controllers.admin.Authors, 'confirmConsent']).as('admin.authors.confirm-consent')`
    `router.post('authors/:id/withdraw-consent', [controllers.admin.Authors, 'withdrawConsent']).as('admin.authors.withdraw-consent')`
    puis régénérer `.adonisjs/*` (`/tmp/d37/gen.sh`) avant typecheck/tests et les committer.
  - [x] 4.7 Mettre à jour le docblock de classe (« Stories 9.1 to 9.4 … consent »).
- [x] **T5 — Client : données et règles** (AC 2, 3, 6)
  - [x] 5.1 `inertia/lib/author_form.ts` : `AuthorFormData.consent: boolean` ; `EMPTY_AUTHOR_FORM.consent = false` ; `hasEnteredAffiliation(affiliations)` = au moins une institution non vide (après `trim`) ; `validateAuthorForm` : `consent && !hasEnteredAffiliation` → `errors.consent = 'authors.form.errors.consent_requires_affiliation'` (défense ; la case est désactivée) ; `toAuthorPayload` : `...(data.consent && hasEnteredAffiliation(data.affiliations) ? { consent: true } : {})`.
  - [x] 5.2 `Edit.tsx` : props `isPublic`, `isIncomplete` (exclues de `formData` comme `id`/`photoUrl`…) ; `useForm` avec `consent: false` ; `requireAffiliation = !isMigrated || isPublic` ; `onSuccess: () => form.reset('photo', 'removePhoto', 'consent')` ; `AuthorStatusBadges` à côté du titre (`isPublic`, `isIncomplete` du serveur) ; état `consentDialog` + `ConsentAuthorDialog` (mode `withdraw`) ouvert par `AuthorForm` via `onWithdrawConsent`.
  - [x] 5.3 `Create.tsx` : `consent: false` vient de `EMPTY_AUTHOR_FORM` ; rien d'autre.
- [x] **T6 — Composants** (AC 2, 4, 5)
  - [x] 6.1 `AuthorForm.tsx` : nouvelles props `isPublic?: boolean` (défaut `false`) et `onWithdrawConsent?: () => void`. Nouvelle section `Section legend={t('authors.form.sections.consent')}` **en dernier** (après « Liens ») contenant l'encadré :
    - non public : `<input type="checkbox" id="consent" className="mt-0.5 size-4 accent-green-700">`, `checked={data.consent && available}`, `disabled={!available}`, `aria-describedby` = `consent-help` (+ `consent-unavailable` si indisponible, + `consent-error` si erreur), `aria-invalid={!!message('consent')}` ; `<label htmlFor="consent">` = `authors.consent.label` ; aide `authors.consent.help` (`text-xs text-stone-600`) ; si indisponible : `<p id="consent-unavailable">` = `authors.consent.unavailable` ; erreur `message('consent')` sous la case ;
    - public : `AuthorStatusBadges isPublic isIncomplete={false}` (ou le badge « Public » seul, mêmes classes) + texte `authors.consent.public_help` + `Button type="button" variant="outline" size="sm"` (icône `UserX`) « Retirer le consentement » → `onWithdrawConsent?.()` ; si `onWithdrawConsent` absent (dialog 9.8), ne pas afficher le bouton.
    - `available = hasEnteredAffiliation(data.affiliations)` (import de `author_form.ts`). Mettre à jour le docblock (« Consent comes with Story 9.4 » → décrit).
  - [x] 6.2 Nouveau `inertia/components/admin/ConsentAuthorDialog.tsx`, calqué sur `DeleteAuthorDialog` (Dialog shadcn, `role="alertdialog"`, garde `useRef` contre le double envoi, `Loader2`, fermeture bloquée pendant l'envoi) : props `target: { id, firstNames, lastNames } | null`, `mode: 'confirm' | 'withdraw'`, `onClose` ; `router.post(urlFor(mode === 'confirm' ? 'admin.authors.confirm-consent' : 'admin.authors.withdraw-consent', { id }), {}, { preserveScroll: true, onFinish })` ; titres `authors.consent.confirm_title` / `withdraw_title`, descriptions avec `name: formatAuthorName(...)`, boutons `authors.consent.confirm_submit` (vert `bg-green-700`) / `withdraw_submit` (`variant="destructive"`).
  - [x] 6.3 `Authors/Index.tsx`, colonne Actions (entre Modifier et Supprimer, boutons `size="sm"`) :
    - `isPublic` → `Button variant="outline"` (icône `UserX`) « Retirer le consentement » → dialog `withdraw` ;
    - non public et `isIncomplete` → bouton `aria-disabled="true"` + `aria-describedby={consent-hint-<id>}` + `opacity-50 cursor-not-allowed` + `onClick={(e) => e.preventDefault()}` dans `Tooltip`/`TooltipTrigger asChild` (contenu `authors.consent.unavailable`) + `<span id=… className="sr-only">` (patron exact du bouton Supprimer bloqué) ;
    - sinon → `Button variant="outline"` (icône `UserCheck`) « Confirmer le consentement » → dialog `confirm`.
    Un seul état `consentTarget: { author, mode } | null` ; `ConsentAuthorDialog` monté une fois à côté de `DeleteAuthorDialog`.
- [x] **T7 — i18n** (AC 1–5, 9) — FR / EN, parité :
  - `authors.form.sections.consent` : « Consentement » / « Consent »
  - `authors.consent.label` : « L'auteur a consenti à la publication de son profil. » / « The author has consented to the publication of their profile. »
  - `authors.consent.help` : « Facultatif. Sans ce consentement, la fiche est créée mais le profil reste non public : le nom apparaît sur les productions, sans lien vers un profil. Vous pourrez le confirmer plus tard dans la fiche de l'auteur. » / « Optional. Without consent, the record is created but the profile stays private: the name appears on productions, without a link to a profile. You can confirm it later from the author's record. »
  - `authors.consent.unavailable` : « Complétez d'abord une affiliation. » / « Add an affiliation first. »
  - `authors.consent.public_help` : « Le profil de cet auteur est public. » / « This author's profile is public. »
  - `authors.consent.confirm_action` : « Confirmer le consentement » / « Confirm consent » ; `withdraw_action` : « Retirer le consentement » / « Withdraw consent »
  - `authors.consent.confirm_title` : « Confirmer le consentement ? » / « Confirm consent? » ; `confirm_description` : « Le profil de {{name}} deviendra public. » / « {{name}}'s profile will become public. » ; `confirm_submit` : « Confirmer » / « Confirm »
  - `authors.consent.withdraw_title` : « Retirer le consentement ? » / « Withdraw consent? » ; `withdraw_description` : « Le profil de {{name}} ne sera plus public. Ses productions restent publiées, son nom s'affichera sans lien. » / « {{name}}'s profile will no longer be public. Their productions stay published; their name will be shown without a link. » ; `withdraw_submit` : « Retirer le consentement » / « Withdraw consent »
  - `authors.consent.flash.confirmed` : « Consentement confirmé. » / « Consent confirmed. » ; `.withdrawn` : « Consentement retiré. » / « Consent withdrawn. » ; `.refused` : « Confirmation impossible : complétez d'abord une affiliation. » / « Cannot confirm: add an affiliation first. »
  - `authors.form.errors.consent_requires_affiliation` : « Complétez d'abord une affiliation. » / « Add an affiliation first. »
  - `activity.action.consent_confirm` : « Consentement confirmé » / « Consent confirmed » ; `activity.action.consent_withdraw` : « Consentement retiré » / « Consent withdrawn »
- [x] **T8 — Tests** (tous AC) — `npm run test:local` uniquement
  - [x] 8.1 `tests/functional/admin/authors_consent.spec.ts` (nouveau ; `// Noms fictifs uniquement (dépôt public).` ; transaction globale ; helpers copiés de `authors_crud.spec.ts`) :
    - création JSON avec `consent: true` → colonnes renseignées (`consentConfirmedById` = admin), journal `create` puis `consent_confirm` `{ name }` ; sans `consent` → NULL, seul `create` ;
    - création multipart (`.field('consent', '1')`, une affiliation) → confirmée ;
    - création `consent: true` avec `affiliations: []` → erreurs flashées `affiliations` **et** `consent`, aucune fiche ;
    - modification d'une fiche non publique avec `consent: true` et un autre champ modifié → `update` + `consent_confirm` ; consentement seul (payload identique sinon) → `consent_confirm` seul, pas d'`update` ;
    - fiche migrée (`migrationKey`) sans affiliation + `consent: true` sans affiliation → erreur `consent`, inchangée ; même requête avec une affiliation → confirmée ;
    - fiche publique + `consent: true` → `consentConfirmedById` inchangé (autre admin), aucun `consent_confirm` ;
    - fiche publique **migrée** + `affiliations: []` → erreur `affiliations`, inchangée ;
    - `POST confirm-consent` : non publique avec affiliation → confirmée, flash `authors.consent.flash.confirmed`, journal, redirection vers le `referer` (`?consent=pending&page=2` conservé) ; déjà publique → aucun changement (`consentConfirmedAt` et `updatedAt` identiques), aucun journal, pas de flash d'erreur ; sans affiliation → flash `error` `authors.consent.flash.refused`, inchangée, aucun journal ;
    - `POST withdraw-consent` : publique → NULL/NULL, flash, journal `consent_withdraw` `{ name }` ; non publique → aucun changement ni journal ;
    - accès : non authentifié → `/admin/login` sur les deux routes ; id malformé / inconnu → 404 ; un `super_admin` peut aussi confirmer ;
    - `GET edit` → `isPublic` / `isIncomplete` corrects.
  - [x] 8.2 `tests/unit/services/author_service.spec.ts` : groupe `consent` — `confirmConsent` (`confirmed` / `unchanged` / `no_affiliation`), `withdrawConsent` (`withdrawn` / `unchanged`), `update` qui vide les affiliations d'une fiche publique → `E_VALIDATION_ERROR` et rien d'écrit, `update` avec `consent` sur une fiche devenue publique entre le chargement et le verrou → `consentConfirmed: false`.
  - [x] 8.3 `tests/unit/validators/author_validator.spec.ts` : `consent` `'1'` / `true` / `'0'` ; `assertAffiliationRule` : non migrée vide → `affiliations` ; migrée vide → OK ; migrée **publique** vide → `affiliations` ; `consent` + vide (migrée) → `consent` ; `consent` + vide (non migrée) → `affiliations` et `consent` ; `consent` + 1 affiliation → OK. Adapter `expectAffiliationError` si nécessaire (il compare la liste exacte des erreurs).
  - [x] 8.4 Lecture de source : `author_form.spec.ts` — remplacer « pas encore de consentement (Story 9.4) » par des assertions : `id="consent"`, `authors.consent.label`, `authors.consent.help`, `aria-describedby`, `disabled={!available}`, `authors.consent.unavailable`, `onWithdrawConsent`, `accent-green-700` ; pages : `Edit` (`requireAffiliation = !isMigrated || isPublic`, `ConsentAuthorDialog`, `'consent'` dans `form.reset`) ; `authors_index_page.spec.ts` — `authors.consent.confirm_action`, `authors.consent.withdraw_action`, `aria-describedby={`consent-hint-` (ou équivalent), `authors.consent.unavailable`, `ConsentAuthorDialog` ; nouveau `tests/unit/components/consent_author_dialog.spec.ts` — `role="alertdialog"`, `useRef`, `admin.authors.confirm-consent`, `admin.authors.withdraw-consent`, `urlFor`, clés `confirm_description` / `withdraw_description`.
  - [x] 8.5 Adapter les attentes existantes touchées : `authors_crud.spec.ts` (`deepEqual` des props de `GET edit` → `isPublic: false`, `isIncomplete: …`), tout test qui déstructure le retour de `AuthorService.update` (champ `consentConfirmed` ajouté), `activity_logs.spec.ts` (9 types).
  - [x] 8.6 Suite complète + `npm run typecheck` + `npm run lint` + `node ace build` verts ; `.adonisjs/*` régénérés (nouvelles routes) et committés.

### Review Findings

Revue adversariale du 2026-11-18 (Blind Hunter, Edge Case Hunter, Acceptance Auditor), constats vérifiés avant correction.

- [x] [Review][Patch] Course : affiliations comptées depuis l'instance chargée avant le verrou → une sauvegarde concurrente qui les retire laisse confirmer le consentement d'une fiche à 0 affiliation (D27) [app/services/author_service.ts] — comptage sous le verrou, décision du consentement sur la ligne verrouillée ; test qui simule la course.
- [x] [Review][Patch] Case cochée devenue indisponible : enregistrement bloqué par une erreur sous une case désactivée, et case recochée à la ressaisie d'une institution (AC2) [inertia/components/admin/AuthorForm.tsx] — décochée dès qu'elle devient indisponible.
- [x] [Review][Patch] Le retrait efface qui avait confirmé et quand, sans trace (fiches importées en 9.6 : aucune entrée `consent_confirm`) [app/controllers/admin/authors_controller.ts] — `metadata.previous { confirmedAt, confirmedById }` dans `consent_withdraw` ; test.
- [x] [Review][Patch] D27 non revérifiée dans `AuthorService.create` (dialog 9.8, imports) [app/services/author_service.ts] — refus `consent_requires_affiliation` ; test.
- [x] [Review][Patch] Refus du service toujours signalé sous « Affiliations », même quand la cause est le consentement [author_service.ts, author_validator.ts] — `consentRequiresAffiliationError()` sur le champ `consent`.
- [x] [Review][Patch] Action sans effet (déjà public / déjà non public) sans aucun retour [authors_controller.ts] — flash « Le profil était déjà public. » / « …n'était déjà plus public. ».
- [x] [Review][Patch] Le dialog bascule en variante « Confirmer » pendant son animation de fermeture [inertia/components/admin/ConsentAuthorDialog.tsx] — mode de la dernière ouverture conservé.
- [x] [Review][Patch] Test i18n aveugle aux clés de `AuthorForm` et aux clés envoyées par le serveur (flash, erreurs) [tests/unit/components/authors_index_page.spec.ts].
- [x] [Review][Defer] Noms accessibles identiques des boutons d'action par ligne (« Confirmer le consentement » ×20), comme « Modifier » / « Supprimer » depuis 9.2 — deferred : à traiter pour toutes les actions de ligne.
- [x] [Review][Defer] Case désactivée hors de l'ordre de tabulation (raison lue seulement en mode lecture) ; `role="alertdialog"` sur un `Dialog` Radix — deferred (même report qu'en 9.2).

Écartés : perte des modifications non enregistrées au retrait depuis la fiche (faux positif : `router.post` d'Inertia 2 a `preserveState: true` par défaut, vérifié dans `@inertiajs/core`), badge « Public » répété dans la section (demandé par l'AC5), ordre des entrées de journal non testé (même horodatage dans la transaction globale des tests ; l'ordre d'écriture est séquentiel dans le contrôleur).

## Dev Notes

### Contraintes non négociables

- **Base Supabase partagée** : **aucune migration** dans cette story (colonnes existantes, `action_type` varchar libre). Jamais de `migration:run` sous `doppler run`, jamais de `rollback` / `fresh` / `reset` / `db:wipe`.
- **Tests** : uniquement `npm run test:local [-- unit|functional]` (Docker `anta-test-db`, port 5433) ; jamais `--files` (bloque le runner).
- **Fichiers générés** : `.adonisjs/*` régénérés (nouvelles routes), jamais édités à la main ; `database/schema.ts` ne doit pas changer.
- **Frontière TS6305** : tout ce qui est sous `inertia/` se teste par lecture de source.
- **Dépôt public** : noms fictifs uniquement ; aucune IP / hôte.
- Aucune nouvelle dépendance (icônes `UserCheck` / `UserX` de `lucide-react`, déjà présent ; case native, pas de composant shadcn `checkbox`).

### Règles métier (P2.1, EXPERIENCE.md)

- **Profil public** = `consent_confirmed_at IS NOT NULL`. « Visible sur le site » (public **et** ≥ 1 production publiée, D11) relève de l'Epic 10 : rien côté public ici.
- **D27** : confirmation impossible sans affiliation — au validateur (`assertAffiliationRule`) **et** au service (ligne verrouillée : `update`, `confirmConsent`). Une fiche publique ne retombe jamais à 0 affiliation, même migrée.
- **D16** : case facultative, décochée par défaut ; sans elle la fiche est créée non publique. La saisie d'une production n'est jamais bloquée (concerne 9.8 : `AuthorForm` doit rester sans dépendance à la page).
- **D17** : retrait → non public ; les productions restent publiées. Aucune suppression de données au retrait (photo, Scholar, département conservés ; leur retrait « sur demande » se fait par la fiche, déjà possible).
- Journal : `consent_confirm` / `consent_withdraw`, `resourceType: 'author'`, `resourceId`, `metadata: { name }` (`AuthorService.displayName`) ; **après** le commit (`ActivityLogService.log` hors transaction, ne lève jamais). Ordre à la création / modification : `create`/`update` d'abord, puis `consent_confirm`.
- Idempotence (AC 7) : décision prise **sous verrou** (`FOR UPDATE`) pour que deux confirmations simultanées ne journalisent qu'une fois.

### Fichiers touchés — état actuel / changement / à préserver

| Fichier | Aujourd'hui (9.3) | Changement 9.4 | À préserver |
|---|---|---|---|
| `app/enums/action_type.ts` | 7 types | + 2 types consentement | valeurs existantes |
| `app/validators/admin/author_validator.ts` | schéma 9.1–9.3 ; `assertAffiliationRule(data, { isMigrated })` | `consent` ; règle étendue (`isPublic`, `consent`) ; helper d'erreur | messages et limites existants ; `affiliations` optionnel (multipart) |
| `app/services/author_service.ts` | `create` (id d'avance, photo, relance slug), `update` (verrou, photo, retour anticipé), `delete`, filtres | consentement dans `create`/`update`, `confirmConsent`, `withdrawConsent` | relance slug limitée à `authors_slug_unique` ; compensation photo ; `updatedAt` explicite ; refus FR55 |
| `app/controllers/admin/authors_controller.ts` | CRUD + photo, `affiliationsOf` (multipart vs JSON), `discardUpload`, `listUrlFrom`, garde UUID | `consent_confirm` après `create`/`update`, props `isPublic`/`isIncomplete` dans `edit`, actions `confirmConsent`/`withdrawConsent` | ordre validation → images → écriture ; journal après commit ; nettoyage des fichiers temporaires |
| `start/routes.ts` | routes auteurs 9.1–9.2 | + 2 `POST` nommées | groupe `middleware.admin()` |
| `inertia/lib/author_form.ts` | types, règles client, `toAuthorPayload` (photo/removePhoto) | `consent`, `hasEnteredAffiliation` | duplication volontaire serveur/client, clés identiques |
| `inertia/components/admin/AuthorForm.tsx` | identité, photo, affiliations ↑↓×, liens ; focus sur 1er `aria-invalid` | section « Consentement » (case / badge + retrait) | annonces `aria-live`, focus, erreurs indexées masquées après déplacement ; réutilisable (9.8) |
| `inertia/pages/admin/Authors/Edit.tsx` | `useForm` + photo + suppression (dialog / texte bloquant) | badges, `requireAffiliation` public, dialog de retrait, reset `consent` | pas de `_method` (PUT multipart) ; suppression 9.2 |
| `inertia/pages/admin/Authors/Index.tsx` | filtres, avatar, tooltip Supprimer, dialog | actions consentement + dialog | filtres, pagination, états vides |
| `inertia/components/admin/ConsentAuthorDialog.tsx` | absent | nouveau | — |
| `inertia/locales/admin/{fr,en}.json` | `authors.*`, `activity.*` | clés T7 | parité |

### Détails d'implémentation (pièges)

- **Multipart** (photo jointe) : `consent: true` → `'1'` dans le FormData d'Inertia ; `vine.boolean()` l'accepte (vérifié par 9.3 pour `removePhoto`). `consent: false` n'est jamais envoyé (omis par `toAuthorPayload`).
- **`affiliationsOf`** (revue 9.3) : JSON sans `affiliations` → erreur `affiliation_required` ; multipart sans champ → `[]`. Ne pas y toucher ; `assertAffiliationRule` reçoit `data` normalisé (`affiliations` + `consent`).
- **`update` et retour anticipé** : aujourd'hui `fields.length === 0` → retour sans transaction. Un envoi « consentement seul » doit entrer dans la transaction (`wantsConsent`). La comparaison `before/after` des affiliations reste la source de `fields`.
- **Instance vs ligne verrouillée** : décider du consentement sur `locked.consentConfirmedAt` (pas sur l'instance chargée avant la transaction), comme `photo_key` en 9.3.
- **`author.affiliations`** est chargé au début de `update` (`author.load('affiliations')`) : son `length` donne le nombre actuel quand les affiliations ne changent pas. (Une affiliation retirée en concurrence est un cas négligeable ; la ligne de l'auteur est verrouillée, pas les affiliations — acceptable, dernier enregistrement gagnant comme en 9.1.)
- **`confirmConsent`** : compter les affiliations **dans** la transaction, après le verrou (un `update` concurrent qui remplace les affiliations prend le même verrou).
- **`redirect().back()`** : depuis la liste, le `referer` conserve filtres et page ; depuis la fiche, retour sur la fiche (elle existe toujours, contrairement à la suppression). Un retrait depuis la liste filtrée « Consentement en attente » ne concerne pas cette liste (fiches non publiques) ; une confirmation fait disparaître la ligne du filtre : comportement attendu.
- **Dialog et focus** : Radix restaure le focus sur l'élément actif avant l'ouverture (le bouton déclencheur) à la fermeture ; garder la structure de `DeleteAuthorDialog` (reports de 9.2 : `role="alertdialog"` sur `Dialog`, pas de primitive `AlertDialog` → même patron, pas de nouvelle dette).
- **Edit après retrait** : Inertia recharge les props de la même page sans remonter le composant ; `useForm` conserve les saisies → la case réapparaît décochée (`consent` déjà `false`).
- **Case indisponible** : `disabled` natif (pas focusable) + texte visible relié par `aria-describedby` — conforme à « actions indisponibles expliquées » (texte visible, comme le texte bloquant de suppression de la fiche). Dans la **liste**, bouton `aria-disabled` focusable + infobulle (AC 4).
- **Badge « Public »** : réutiliser `AuthorStatusBadges` (classes D32 existantes) plutôt que dupliquer les classes.

### Infra existante (NE PAS réinventer)

- `ActivityLogService.log({ adminUserId, actionType, resourceType, resourceId, metadata })` ; page Journal générique (`activity.action.${type}`, « Auteur — {nom} » via `metadata.name`).
- `DeleteAuthorDialog` (modèle du nouveau dialog), `Tooltip*` (`~/components/ui/tooltip`, `TooltipProvider` déjà autour de la page Index), `AuthorStatusBadges`, `formatAuthorName`, `urlFor` (`~/client`), flash `success` / `error` traduits par `AdminLayout` (`notify`).
- Convention des actions d'état : `productions/:id/publish` / `unpublish` (POST, `redirect().back()`, flash).

### Gotchas (memory du topic + code)

- Japa : `.withCsrfToken()` sur POST/PUT, `.redirects(0)`, `.loginAs(admin)` ; `SESSION_DRIVER=memory`. Pour tester `back()`, poser `.header('referer', 'http://localhost:3333/admin/authors?consent=pending&page=2')` (patron de `authors_list.spec.ts`).
- Flash et erreurs : `response.flashMessages` / helper `flashedErrors` de `authors_crud.spec.ts` (`errors` ou `inputErrorsBag`).
- Tuyau : nouvelles routes → régénérer le registre (`/tmp/d37/gen.sh`) **avant** typecheck (sinon `urlFor('admin.authors.confirm-consent')` ne type pas).
- `inertia.render(page, {})` exige le 2e argument (inchangé).
- `DateTime.now()` (luxon) pour `consentConfirmedAt` ; comparer dans les tests via `toISO()` ou non-nullité.

### Intelligence des stories précédentes (9.1–9.3)

- Verrou `FOR UPDATE` dans la transaction pour sérialiser les écritures d'une fiche ; journal après commit.
- 9.2 et 9.3 ont dû compléter un `deepEqual` de `GET edit` après l'ajout d'une prop : idem ici (`isPublic`, `isIncomplete`).
- Revue 9.3 : JSON sans `affiliations` refusé (jamais d'effacement silencieux) ; fichiers temporaires supprimés après `store`/`update` (le `finally` existant couvre déjà les nouveaux chemins).
- Revue 9.2 : double soumission des dialogs gardée par `useRef` ; libellés « production(s) » imposés par l'AC.
- Reports ouverts hors périmètre : `page` non borné, `<Link><Button/></Link>`, `role="alertdialog"` sur `Dialog`, objets R2 orphelins, recherche non indexée (9.7).
- 588 tests verts à la fin de la revue 9.3.

### Git (branche `feat/epic-9-authors`)

- `33e19b8`/`7e24424` (9.1), `7826be9`/`fafdea7` (9.2), `744296a`/`840c6bf` (9.3). Conventions : fichiers `snake_case`, docblocks anglais dans `app/`, commentaires de tests en français, message `feat(authors): … (story 9.4)`.

### Project Structure Notes

- Nouveaux fichiers : `inertia/components/admin/ConsentAuthorDialog.tsx`, `tests/functional/admin/authors_consent.spec.ts`, `tests/unit/components/consent_author_dialog.spec.ts`.
- Écarts assumés vis-à-vis de l'epic : (1) clé d'erreur `authors.form.errors.consent_requires_affiliation` pour la case (champ `consent`) en plus de `affiliation_required` ; (2) la case est indisponible tant qu'aucune **institution** n'est saisie (une ligne d'affiliation vide ne suffit pas, elle serait refusée à l'enregistrement) ; (3) les routes renvoient sans flash quand l'état est déjà celui demandé (AC 7 : « aucun changement »).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.4] (+ « Règles communes » de l'Epic 9 ; 9.5–9.8 et Epic 10 pour le hors-périmètre)
- [Source: architecture.md#P2.1] (profil public, D27 au service et au validateur, `minLength(1)` d'une fiche publique) ; [#P2.6] (routes `.confirm-consent` / `.withdraw-consent`, validateur `consent`, journal) ; [#P2.10] P2-13 ; [#P2.3] (invalidation du cache → Epic 12)
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] Voice and Tone (Consentement D16, Confirmer D27, Retirer D17), Component Patterns (AuthorForm, « Consentement : confirmer / retirer », Badges auteurs), états admin, parcours 4 et 5
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md] `components.consent-box`, `badge-public` / `badge-not-public`, AuthorForm (case `accent-green-700`, aide `body-sm`), AdminAuthorsTable (actions outline, indisponible `opacity-50` + infobulle) ; maquettes `admin-authors-list.html` (icônes UserCheck / UserX), `admin-author-picker.html` (encadré de consentement)
- [Source: _bmad-output/implementation-artifacts/9-1-*.md, 9-2-*.md, 9-3-*.md] Dev Notes, Review Findings, reports ; `deferred-work.md`
- Code : `app/services/author_service.ts`, `app/controllers/admin/authors_controller.ts`, `app/validators/admin/author_validator.ts`, `app/controllers/admin/productions_controller.ts` (`publish`/`unpublish`), `inertia/components/admin/{AuthorForm,DeleteAuthorDialog,AuthorStatusBadges}.tsx`, `inertia/pages/admin/Authors/*`, `tests/functional/admin/{authors_crud,authors_list,activity_logs}.spec.ts`, `/home/atlas/projects/anta/CLAUDE.local.md`

## Questions ouvertes (non bloquantes, défauts retenus)

1. **Flash sur une action sans effet** (confirmation d'un profil déjà public) : défaut = aucun flash (rien n'a changé ; la page rechargée montre l'état réel).
2. **Position de la section Consentement** dans `AuthorForm` : défaut = en dernier, après « Liens » (comme dans la maquette du dialog).
3. **Bouton de retrait** : `variant="destructive"` dans le dialog (action qui retire la visibilité), bouton déclencheur `outline` comme les autres actions de ligne.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5), skill `bmad-dev-story`.

### Debug Log References

- `admin_activity_logs.action_type` vérifié : `varchar` sans CHECK ni enum → aucune migration.
- `redirect().back()` d'Adonis (`define_config-*.js`) ne garde que le chemin du référent (query string perdue sans `withQs`) : les actions de consentement utilisent `consentReturnUrl` (fiche de l'auteur, ou liste avec ses filtres via `listUrlFrom`, sinon `/admin/authors`), conforme à AC 4.
- 1er passage de la suite : `create` sans consentement journalisait `consent_confirm` (`consentConfirmedAt` `undefined` sur l'instance neuve, `!== null` vrai) → colonnes posées explicitement à `null` dans `createOnce`. Deux entrées d'une même requête partagent leur horodatage : les tests comparent les types de journal triés.
- Validations finales : `npm run test:local` 621/621 verts (588 avant la story), `npm run lint`, `npm run typecheck`, `node ace build` verts ; `.adonisjs/*` régénérés (2 routes).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- `ActionType.CONSENT_CONFIRM` / `CONSENT_WITHDRAW` ; page Journal inchangée (filtre et libellés génériques), i18n `activity.action.consent_*`.
- Validateur : `consent` (`vine.boolean`), `assertAffiliationRule` étendu (`isPublic` : une fiche publique, même migrée, garde ≥ 1 affiliation ; `consent` sans affiliation → erreur `consent` `consent_requires_affiliation`, cumulée avec `affiliations`), helper `affiliationRequiredError()`.
- `AuthorService` : consentement à la création (même transaction), `update` (options `adminId`, retour `consentConfirmed`, décision et règles D27 / fiche publique sur la ligne verrouillée, envoi « consentement seul » sans `fields`), `confirmConsent` (`confirmed` / `unchanged` / `no_affiliation`, affiliations comptées sous verrou), `withdrawConsent` (`withdrawn` / `unchanged`).
- Contrôleur : `consent_confirm` journalisé après `create` / `update` (après commit), props `isPublic` / `isIncomplete` de la fiche, actions `confirmConsent` / `withdrawConsent` (flash succès ou refus, aucun flash ni journal si l'état est déjà celui demandé), routes nommées `admin.authors.confirm-consent` / `.withdraw-consent` dans `middleware.admin()`.
- Client : `AuthorFormData.consent`, `hasEnteredAffiliation`, règle client et `toAuthorPayload` (consent seulement si disponible) ; `AuthorForm` section « Consentement » en dernier (case facultative dans l'encadré, aide D16 et texte « Complétez d'abord une affiliation. » reliés, case désactivée et décochée sans institution saisie ; profil public : badge « Public » + « Retirer le consentement ») ; `ConsentAuthorDialog` (confirmer / retirer, `alertdialog`, garde de double envoi) ; `Edit` (badges de statut, `requireAffiliation = !isMigrated || isPublic`, dialog de retrait, reset `consent`) ; `Index` (Retirer / Confirmer / Confirmer indisponible `aria-disabled` + infobulle + texte relié).
- Tests : `authors_consent.spec.ts` (17 tests fonctionnels), groupe consentement de `author_service.spec.ts` (7), `author_validator.spec.ts` (3), lecture de source (`author_form`, `authors_index_page`, `lib/author_form`), `activity_logs.spec.ts` (9 types, filtre `consent_confirm`), `activity_log_service.spec.ts`, `authors_crud.spec.ts` (props de la fiche).
- Écarts : (1) les assertions du dialog sont dans `authors_index_page.spec.ts` (groupe « consentement ») au lieu d'un fichier `consent_author_dialog.spec.ts` séparé ; (2) retour après action par `consentReturnUrl` plutôt que `redirect().back()` (qui perd les filtres) ; (3) le helper `blockedButton` des tests de lecture de source prend désormais l'attribut recherché en paramètre (deux boutons `aria-disabled` dans la liste).

### File List

- `app/enums/action_type.ts` (modifié)
- `app/validators/admin/author_validator.ts` (modifié)
- `app/services/author_service.ts` (modifié)
- `app/controllers/admin/authors_controller.ts` (modifié)
- `start/routes.ts` (modifié)
- `.adonisjs/client/registry/index.ts`, `.adonisjs/client/registry/schema.d.ts`, `.adonisjs/client/registry/tree.d.ts`, `.adonisjs/server/routes.d.ts` (régénérés)
- `inertia/lib/author_form.ts` (modifié)
- `inertia/components/admin/AuthorForm.tsx` (modifié)
- `inertia/components/admin/ConsentAuthorDialog.tsx` (nouveau)
- `inertia/pages/admin/Authors/Edit.tsx` (modifié)
- `inertia/pages/admin/Authors/Index.tsx` (modifié)
- `inertia/locales/admin/fr.json`, `inertia/locales/admin/en.json` (modifiés)
- `tests/functional/admin/authors_consent.spec.ts` (nouveau)
- `tests/functional/admin/authors_crud.spec.ts` (modifié)
- `tests/functional/admin/activity_logs.spec.ts` (modifié)
- `tests/unit/services/author_service.spec.ts` (modifié)
- `tests/unit/services/activity_log_service.spec.ts` (modifié)
- `tests/unit/validators/author_validator.spec.ts` (modifié)
- `tests/unit/components/author_form.spec.ts` (modifié)
- `tests/unit/components/authors_index_page.spec.ts` (modifié)
- `tests/unit/lib/author_form.spec.ts` (modifié)
- `_bmad-output/implementation-artifacts/9-4-confirmer-et-retirer-le-consentement-d-un-auteur.md` (ce fichier)

## Change Log

| Date | Version | Description |
|---|---|---|
| 2026-11-18 | 0.1 | Story créée (bmad-create-story), statut ready-for-dev. |
| 2026-11-18 | 1.0 | Implémentation (bmad-dev-story) : types de journal, case de consentement (D16, D27), actions confirmer / retirer (liste et fiche, D17), règles au validateur et au service, 33 tests ajoutés (621 verts). Statut review. |
- 2026-11-18 : code review — 8 correctifs, 2 reports ; 623 tests verts, lint, typecheck et build verts.
