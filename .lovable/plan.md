## Vision

Transformer l'app en logiciel SaaS pro de suivi d'entretien paysager, mobile-first, esthétique Notion/Linear (vert profond, beige, gris anthracite). Construction **par étapes** avec auth (email + Google) et Lovable AI. L'écran formulaire actuel est remplacé par une vraie architecture multi-pages.

## Architecture technique

- **Auth** : email/mot de passe + Google, routes protégées sous `_authenticated/`, table `profiles` + `user_roles`.
- **Base de données (Supabase)** : `clients`, `interventions`, `intervention_tasks`, `intervention_photos`, `garden_health` (carnet de santé), `recommendations` (préconisations). RLS scopée par `auth.uid()`, GRANT sur chaque table.
- **Stockage** : bucket `chantier-photos` (existant) pour photos clients, conservées dans l'historique.
- **PDF** : génération premium côté client (jsPDF) — page de couverture, synthèse, travaux, photos, préconisations, signature.
- **IA** : `createServerFn` + Lovable AI Gateway pour résumé pro, état du jardin, recommandations saisonnières.
- **Routing** : `/` (dashboard), `/clients`, `/clients/$id`, `/interventions/new`, `/interventions/$id`, `/auth`.

## Découpage par étapes

```text
Étape 1 — Fondations (cette livraison)
  • Auth email + Google, page /auth, gate _authenticated
  • Schéma DB complet (clients, interventions, tasks, photos, health, recommendations)
  • Base clients : liste + recherche instantanée + fiche client + CRUD
  • Design system (couleurs naturelles, typo, composants cartes)

Étape 2 — Interventions & travaux
  • Création compte-rendu : client, date, type
  • Préchargement tâches prévues + bibliothèque de tâches fréquentes
  • Statuts : réalisé / partiel / reporté / impossible + observations/conseils
  • Photos : upload, drag&drop, prise directe, compression, légendes, galerie, sélection PDF

Étape 3 — IA, carnet de santé, préconisations
  • Assistant IA (résumé, état jardin, recommandations) via Lovable AI
  • Carnet de santé du jardin (notation + frise chronologique historisée)
  • Préconisations / opportunités commerciales réutilisables

Étape 4 — PDF premium & dashboard
  • PDF haut de gamme (couverture, synthèse, travaux, photos, préconisations, signature)
  • Dashboard (interventions, rapports, clients actifs, préconisations en attente, historique récent)
```

## Étape 1 en détail (ce que je livre maintenant)

1. Migration DB : tables ci-dessus + RLS + GRANT + triggers `updated_at` + `profiles`/`user_roles`/`has_role`.
2. Auth : page `/auth` (email + Google), gate `_authenticated`, header avec déconnexion.
3. Design system dans `src/styles.css` (tokens vert profond / beige / anthracite, typo élégante).
4. Base clients : `/clients` (liste + recherche), création/édition client, fiche `/clients/$id` (infos + onglets historique vides pour l'instant).
5. Dashboard placeholder `/` relié aux vraies données clients.
6. Suppression de l'ancien `RapportChantier` de la page d'accueil.

## Notes

- Connexion requise : chaque utilisateur ne voit que ses propres données (RLS).
- Google OAuth configuré via le broker Lovable dans la même étape.
- Les étapes 2-4 suivront après validation de chaque étape précédente.
