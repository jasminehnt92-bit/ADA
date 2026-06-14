# Roadmap de développement

> À chaque nouvelle session, colle en premier message : ce fichier + `architectureV1.4.md` + le message indiqué dans la section "Comment démarrer la session".

---

## Identité visuelle (contrainte permanente)

À rappeler dans chaque session. Ne jamais laisser Claude décider seul.

**Palette panafricaniste urbaine :**
- Fond principal : `#0A0A0A` (noir profond)
- Fond secondaire : `#141414`
- Or/accent primaire : `#D4AF37`
- Vert : `#2D6A4F`
- Rouge : `#C1121F`
- Texte principal : `#F5F5F5`
- Texte secondaire : `#A0A0A0`

**Typographie :**
- Titres : `Clash Display` (Google Fonts) — bold, moderne, pas générique
- Corps : `DM Sans` — lisible, neutre sans être banal

**Principes de design (à respecter absolument) :**
- Pas de gradient violet/bleu
- Pas de cartes avec ombre portée floue
- Pas de coins ultra-arrondis (max 8px)
- Layouts asymétriques plutôt que symétriques
- Espacements généreux et typographie grande
- Référence d'ambiance : Resident Advisor (ra.co) — sombre, éditorial, dense mais lisible

---

## Sessions de développement

### Session 0 — Setup (à faire toi-même, voir setup.md)
Durée estimée : 1h
Pas de Claude pour cette session — c'est de la config pure.

---

### Session 1 — Base du projet + Design System
**Ce qu'on fait :** scaffolding Next.js, configuration Tailwind avec les couleurs custom, composants de base (Button, Badge, Avatar, Card), layout global avec la navbar et le FAB messagerie.

**Pourquoi en premier :** tout le reste va hériter de ce design system. Si on le définit bien ici, les sessions suivantes sont cohérentes automatiquement.

**Comment démarrer la session :**
> "On commence le développement. Voici l'architecture du projet [coller architectureV1.4.md] et la roadmap [coller roadmap.md]. On attaque la Session 1 : setup Next.js + design system + composants de base + navbar."

**Livrable :** projet Next.js qui tourne en local avec la navbar fonctionnelle et les composants de base.

---

### Session 2 — Supabase + Auth
**Ce qu'on fait :** connexion Supabase, création des tables (SQL à exécuter dans Supabase), configuration Supabase Auth (magic link + Google), page Connexion, page Inscription, middleware de protection des routes.

**Pourquoi ici :** l'auth est transversale à tout — mieux vaut la poser avant de construire les pages qui en dépendent.

**Comment démarrer la session :**
> "On continue le projet. Voici l'architecture [coller architectureV1.4.md] et la roadmap [coller roadmap.md]. La Session 1 est terminée (navbar + design system ok). On attaque la Session 2 : Supabase + Auth."

**Livrable :** connexion/inscription fonctionnelles, tables créées dans Supabase, routes protégées.

---

### Session 3 — Homepage Events
**Ce qu'on fait :** page Explorer les events, carte Paris (points par date), bandes horizontales défilantes, section "À venir", filtres et barre de recherche, sections "À découvrir" et "Populaires".

**Comment démarrer la session :**
> "On continue le projet. Voici l'architecture [coller architectureV1.4.md] et la roadmap [coller roadmap.md]. Sessions 1 et 2 terminées. On attaque la Session 3 : homepage Events."

**Livrable :** page Explorer fonctionnelle avec données de test (seed).

---

### Session 4 — Page détail événement
**Ce qu'on fait :** page `/events/[id]`, affichage image couverture, infos complètes, liste des intervenants avec rôle + lien profil, carte Google Maps, bouton billetterie externe, compteur "J'y vais / Intéressé" en temps réel (Supabase realtime).

**Comment démarrer la session :**
> "On continue le projet. Voici l'architecture [coller architectureV1.4.md] et la roadmap [coller roadmap.md]. Sessions 1-3 terminées. On attaque la Session 4 : page détail événement."

**Livrable :** page événement complète avec compteur temps réel.

---

### Session 5 — Profils
**Ce qu'on fait :** page recherche profils (filtres par rôle, disponibilités), page profil public (photo, bio, activités + portfolio par activité, events passés/à venir, bouton contacter), page Mon profil (édition).

**Comment démarrer la session :**
> "On continue le projet. Voici l'architecture [coller architectureV1.4.md] et la roadmap [coller roadmap.md]. Sessions 1-4 terminées. On attaque la Session 5 : pages Profils."

**Livrable :** profil public + recherche + édition fonctionnels.

---

### Session 6 — Création d'événement
**Ce qu'on fait :** formulaire 3 étapes (infos générales → intervenants & tags → récapitulatif), Google Maps autocomplete, upload image, recherche d'intervenants avec envoi de demande, autocomplete des rôles, soumission vers la table `soumissions`.

**Comment démarrer la session :**
> "On continue le projet. Voici l'architecture [coller architectureV1.4.md] et la roadmap [coller roadmap.md]. Sessions 1-5 terminées. On attaque la Session 6 : formulaire de création d'événement."

**Livrable :** formulaire complet, soumission en base, demande envoyée aux intervenants.

---

### Session 7 — Messagerie
**Ce qu'on fait :** FAB messagerie, liste des conversations, thread de messages, envoi en temps réel (Supabase realtime), notification email via Resend.

**Comment démarrer la session :**
> "On continue le projet. Voici l'architecture [coller architectureV1.4.md] et la roadmap [coller roadmap.md]. Sessions 1-6 terminées. On attaque la Session 7 : messagerie."

**Livrable :** messagerie temps réel fonctionnelle + notif email.

---

### Session 8 — Backoffice modérateur
**Ce qu'on fait :** file de modération, détail soumission (valider / refuser + note), gestion des profils (badge vérifié), gestion des rôles (fusion de doublons).

**Comment démarrer la session :**
> "On continue le projet. Voici l'architecture [coller architectureV1.4.md] et la roadmap [coller roadmap.md]. Sessions 1-7 terminées. On attaque la Session 8 : backoffice modérateur."

**Livrable :** backoffice complet accessible aux modérateurs uniquement.

---

### Session 9 — PWA + polish final
**Ce qu'on fait :** configuration PWA (manifest, service worker, icônes), optimisations mobile, métadonnées SEO, tests sur iPhone/Android, corrections de bugs visuels, déploiement Vercel en production.

**Comment démarrer la session :**
> "On continue le projet. Voici l'architecture [coller architectureV1.4.md] et la roadmap [coller roadmap.md]. Sessions 1-8 terminées. On attaque la Session 9 : PWA + polish + mise en production."

**Livrable :** app installable sur mobile, en ligne sur le domaine.

---

## Ce qui reste à définir

- [x] Nom de l'app → **Rasta** (Session 9 : manifest PWA, métadonnées, logo navbar). Domaine à acheter sous ce nom.
