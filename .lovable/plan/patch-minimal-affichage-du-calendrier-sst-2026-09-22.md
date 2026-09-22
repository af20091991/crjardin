# Patch minimal — affichage du Calendrier SST

## Résultat
- Afficher toutes les disponibilités et tous les commentaires directement dans chaque journée, sur ordinateur et mobile.
- Ajouter un badge compact et stable : logo existant pour ma disponibilité, montagne rose pour Chloé, brique rouge pour Fanny, icône/couleur déterministes pour les autres SST.
- Conserver le clic sur une journée et l’infobulle existante pour modifier ou supprimer.

## Limites
- Modifier uniquement `src/routes/_authenticated/pilot.calendrier.tsx`.
- Ne changer ni données, ni requêtes, ni droits, ni base, ni dépendances.
- Vérifier l’affichage de plusieurs utilisateurs, l’absence de « Fiche SST », TypeScript et la compilation.
