# Rétablir la saisie des jours travaillés

- Rendre la colonne « Jours travaillés » toujours accessible dans le suivi mensuel existant.
- Enregistrer les jours dans l’exercice réellement affiché, avec les droits d’édition existants et la sauvegarde déjà disponible.
- Conserver les valeurs enregistrées, les champs vides et les calculs actuels ; aucun préremplissage ni migration.
- Vérifier la saisie, les calculs et la sauvegarde par tests, puis contrôler l’aperçu dans les limites de l’accès disponible.
- Ajouter l’entrée de changelog. Ne pas publier.

## Détails techniques
La colonne `pilot_hours.jours_travailles` est déjà nullable et persistante. Le composant utilise actuellement l’année civile pour les écritures alors que les lectures suivent l’exercice global ; la colonne peut également être masquée par une préférence d’affichage. Corriger ces deux points dans `HourlyRateSection`, réutiliser `useRole().canEdit` et conserver `upsertHours`/`computeMonths`/`monthlyTotals`.

## Accès et sécurité
Le compte du demandeur n’a pas de session de test disponible : le contrôle authentifié réel nécessitera sa connexion dans l’aperçu. Trois alertes de lecture hors de ce module nécessitent un choix de droits avant modification ; aucune restriction ne sera appliquée sans accord.