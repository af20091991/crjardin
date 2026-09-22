# Refonte ciblée d’Assistant AP

## Objectif
Transformer uniquement la page **Assistant AP** en outil de suivi compact, lisible et directement exploitable, sans modifier les données, les règles métier ni les accès existants.

## Modifications prévues
- Remplacer les quatre grandes cartes de chiffres par une ligne synthétique : chantiers, éléments à faire et éléments à relancer.
- Ajouter trois filtres réellement actifs — **Tous**, **À faire**, **À relancer** — et une recherche légère par nom de chantier.
- Présenter les chantiers sous forme de cartes sobres, toujours triées avec la logique existante.
- Ouvrir un seul chantier directement dans sa carte, sans grande fenêtre modale.
- Afficher les fournitures ouvertes en lignes compactes : fourniture, fournisseur, opération, date et état simplifié.
- Conserver l’édition rapide des champs existants, avec le commentaire dans une zone secondaire discrète.
- Afficher le formulaire d’ajout d’une fourniture sous les lignes, puis le refermer après succès.
- Conserver les notes du chantier dans la carte ouverte et la création d’un chantier dans une petite fenêtre.
- Protéger les suppressions d’une fourniture et d’un chantier avec la confirmation déjà utilisée dans l’application.
- Prévoir les états de chargement, erreur, liste vide et sauvegarde en cours, sans rechargement complet.

## Affichage des états
- `a_faire` → **À faire**
- `commande_reserve` et `retrait_livraison_prevu` → **En cours**
- `ok` → **Fait**
- `a_relancer` → **À relancer**

Les valeurs enregistrées restent strictement inchangées ; seuls les libellés visibles sont simplifiés.

## Périmètre technique
- Modifier uniquement `src/routes/_authenticated/pilot.assistant-ap.tsx`.
- Réutiliser les fonctions existantes de `src/lib/assistant-ap.ts` sans les modifier.
- Aucun changement de table, migration, règle d’accès, API, dépendance ou autre module.
- Utiliser les composants et couleurs sémantiques déjà présents dans Pilot Pro.

## Vérification
- Contrôler TypeScript et le dernier état de compilation.
- Vérifier sur ordinateur et mobile : absence de défilement horizontal, filtres, recherche, ouverture/fermeture d’une carte.
- Vérifier avec une session réelle les parcours existants : création de chantier, ajout de fourniture, modifications fournisseur/date/statut/commentaire, suppressions et rafraîchissement immédiat des données.
