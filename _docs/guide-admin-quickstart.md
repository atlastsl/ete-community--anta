# Guide administrateur Anta — Quick Start

> Version condensée. Pour le détail complet (comptes, statistiques, FAQ, annexes), voir [Guide administrateur](guide-admin.md).

---

## En bref

| Élément | Détail |
|---------|--------|
| **URL** | `/admin/login` |
| **Appareil** | Ordinateur (≥ 1024 px de large) — pas de panel sur mobile |
| **Première connexion** | Mot de passe provisoire → définir un mot de passe permanent (min. 12 caractères) |

---

## 1. Publier une production (flux principal)

C'est la tâche la plus courante : rendre une œuvre **visible sur le site public**.

### Étapes

1. Menu **Productions** → **Créer une production**
2. Saisissez au minimum le **titre** → **Enregistrer brouillon**
3. Complétez le formulaire jusqu'au bandeau **vert** en haut (*« Tous les champs requis sont remplis »*)
4. Section **Fichiers & Liens** : ajoutez **un fichier** (PDF, EPUB, MP4, MP3, AAC — max **100 Mo**) **ou** **un lien externe**
5. Cliquez **Publier**

**Résultat :** statut **Publié**, production visible sur le site.

### Bandeau orange ?

Cliquez dessus : il liste les champs manquants avec des liens directs. Complétez-les, puis repassez au vert.

### Règle licence (fichiers / liens)

| Licence | Minimum pour publier |
|---------|----------------------|
| Production membre / Licence libre | **Un fichier** ou **un lien** |
| Lien externe (copyright) | **Au moins un lien** (fichier seul insuffisant) |

---

## 2. Uploader un fichier

**Formats :** PDF, EPUB, MP4, MP3, AAC — **100 Mo max**, **un fichier à la fois**.

### Sur une production déjà enregistrée (page d'édition)

1. Section **Fichiers & Liens**
2. Glisser-déposer ou **Parcourir**
3. Attendre la fin de l'envoi → *« Fichier ajouté. »*

### À la création (avant la première sauvegarde)

1. Ajoutez le fichier → statut **« En attente »**
2. **Enregistrer brouillon** → le fichier est envoyé automatiquement

*(Les liens externes suivent le même principe « En attente ».)*

---

## 3. Modifier une production publiée

1. **Productions** → **Modifier** sur la ligne voulue
2. Changez les champs
3. **Enregistrer** ← **obligatoire avant toute autre action**
4. Pour retirer du site : **Dépublier** (redevient **brouillon**, invisible publiquement)

> **Piège fréquent :** cliquer **Publier** sans **Enregistrer** d'abord — vos dernières modifications ne sont **pas** prises en compte.

---

## 4. Champs à connaître (publication)

**Obligatoires pour publier :**

- **Général :** Titre, Auteur(s), Catégorie, Domaine, Sous-domaine, Langue, Pays
- **Contenu :** Résumé, Tags, Date de publication de l'œuvre
- **Licence :** Statut de licence
- **Fichiers & Liens :** selon la licence (voir tableau § 1)

**Saisie auteurs / tags / sous-domaines :** tapez une valeur → **Entrée** ou **virgule** pour ajouter une pastille.

**Catégorie / domaine :** menus déroulants (pas de texte libre). Les sous-domaines dépendent du domaine choisi.

---

## 5. Messages utiles

| Message | Signification |
|---------|---------------|
| *Brouillon enregistré.* | Première sauvegarde OK |
| *Modifications enregistrées.* | Mise à jour OK |
| *Production publiée.* | Visible sur le site public |
| *Production dépubliée.* | Repassée en brouillon |
| *Fichier trop volumineux. Maximum 100 Mo.* | Réduire le fichier ou utiliser un lien externe |
| *Publication impossible : des champs obligatoires sont manquants.* | Bandeau encore orange ou règle fichiers/liens non respectée |

---

## 6. Besoin d'aide ?

| Problème | Action |
|----------|--------|
| **Publier** grisé | Compléter le bandeau orange + vérifier fichier/lien |
| Erreur upload | Vérifier format et taille (100 Mo) |
| Panel illisible sur téléphone | Utiliser un ordinateur |
| Compte bloqué | Contacter un Super Admin |

**Guide complet :** [guide-admin.md](guide-admin.md)

---

*Anta — Quick Start admin — juillet 2026*

**Export PDF :** `python scripts/md_to_pdf.py _docs/guide-admin-quickstart.md`
