# Refonte moderne de l'application

Objectif : une interface plus moderne, plus fluide, où l'on trouve l'information plus vite — sans changer les fonctionnalités métier. Je procède par étapes et je te montre chaque lot avant de passer au suivant.

Tes choix retenus :
- **Couleurs** : vert forêt actuel affiné (crème #F7F5EF, vert #4F8E33, orange #EE8627, encre #2F3A2E)
- **Typographie** : Syne (titres) + Plus Jakarta Sans (texte)
- **Navigation** : sidebar repliable en icônes
- **Accueil** : actions rapides + alertes/rappels en priorité

---

## Étape 1 — Fondations visuelles (design system)

- Charger Syne + Plus Jakarta Sans (remplacent Fraunces + Inter).
- Affiner la palette dans `src/styles.css` : fond crème plus doux, contrastes retravaillés, coins un peu plus arrondis, ombres plus légères et modernes.
- Ajuster titres/typo pour un rendu plus aéré.

Livrable : l'app garde son organisation actuelle mais change d'allure. Tu valides le « look » avant qu'on touche à la structure.

## Étape 2 — Nouvelle navigation (sidebar repliable)

- Sidebar qui se réduit en bande d'icônes (avec bouton pour replier/déplier), état mémorisé.
- Icônes toujours visibles quand repliée, libellés au survol.
- Regroupements conservés : CR Pro, SST Pro, Catalogue Pro, Pilot Pro, Administration.
- Version mobile : barre du bas conservée, améliorée.

Livrable : navigation plus compacte, plus d'espace pour le contenu.

## Étape 3 — Tableau de bord repensé

- En haut : bloc **Actions rapides** (nouveau CR, nouvelle fiche, nouveau client).
- En dessous : **Alertes & rappels** (brouillons anciens, préconisations en attente).
- Puis vue d'ensemble condensée (derniers éléments).
- Recherche mise en avant pour retrouver clients/fiches rapidement.

Livrable : on voit l'essentiel dès l'arrivée.

## Étape 4 — Onglet « Personnalisation » (Administration)

Nouvel onglet dans Administration pour que tu décides toi-même de l'apparence, avec aperçu en direct :
- **Couleurs** : choix de la couleur principale et de l'accent (palettes prédéfinies + sélecteur libre).
- **Thème** : clair / sombre / automatique.
- **Densité** : confortable / compact.
- **Arrondis** : doux / marqués.
- **Agencement du menu** : afficher/masquer et réordonner les groupes et onglets.
- Bouton « Réinitialiser ».

Les préférences sont enregistrées (par utilisateur) et appliquées instantanément via les variables de thème.

---

## Détails techniques

- **Polices** : `<link>` Google Fonts dans `src/routes/__root.tsx` + `--font-sans`/`--font-serif` dans `@theme` (pas d'@import URL dans styles.css).
- **Sidebar** : refonte de `src/components/AppShell.tsx` (état replié en localStorage).
- **Personnalisation** :
  - Table `app_preferences` (user_id, JSON de réglages) + RLS + GRANT, ou stockage local si tu préfères garder ça simple au départ.
  - Un `ThemeProvider` qui applique les variables CSS (couleur, densité, radius, thème) au chargement.
  - Nouvelle route `src/routes/_authenticated/personnalisation.tsx` + entrée dans le groupe Administration.
- **Aucune modification de la logique métier** (comptes-rendus, clients, PDF, emails restent identiques).

---

### Question avant de démarrer
1. Pour la personnalisation : tu veux que les réglages soient **par utilisateur et synchronisés** (base de données) ou juste **sur cet appareil** (plus simple, sans backend) ?
2. On démarre par l'**Étape 1** (les couleurs + polices) pour que tu valides le style, puis on enchaîne ?
