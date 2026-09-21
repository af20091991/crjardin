# Remplacement du Calendrier SST

## Résultat attendu
- Conserver une unique page mensuelle « Calendrier SST ».
- Afficher les noms et commentaires de toutes les disponibilités du mois.
- Permettre à chacun d’ajouter, modifier ou retirer uniquement sa disponibilité.
- Permettre à l’administrateur de supprimer toute disponibilité.

## Nettoyage et sécurité
- Vérifier qu’aucun écran, service ou objet de base de l’ancien planning complexe n’est encore utilisé.
- Associer toute création au compte connecté, sans identifiant utilisateur fourni par l’interface.
- Confirmer la contrainte d’unicité par utilisateur et date, les droits en base et l’absence d’accès public.

## Validation
- Tester les calculs de grille mensuelle et les actions principales.
- Vérifier TypeScript, le build automatique et les règles de sécurité.
- Contrôler la page sur ordinateur et mobile avec une session authentifiée.

## Détails techniques
- Réutiliser `sst_availability_calendar`, déjà dédiée au besoin minimal.
- Ne modifier aucun autre module SST ou Pilot Pro.
