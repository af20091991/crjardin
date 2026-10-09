# Backup PP CA

## Objectif
Créer une sauvegarde Excel hebdomadaire fidèle à la page Chiffre d’affaires, conservée dans PP et administrable uniquement par les admins.

## Mise en œuvre
1. **Règles et données**
   - Réutiliser les sources et fonctions de calcul de `/pilot/ca` pour l’exercice serveur courant, N-1 et l’historique.
   - Isoler et tester la semaine ISO, le nom de fichier et la sélection des deux sauvegardes les plus récentes.
2. **Fichier Excel**
   - Générer côté serveur un onglet `CA <année>` avec ExcelJS.
   - Reproduire la synthèse, les détails mensuels, styles, formats et vraies formules demandés, sans valeur inventée.
3. **Stockage et sécurité**
   - Créer le bucket privé `pp-backups` et les règles admin.
   - Ajouter `pp_backup_runs` par migration avec GRANT, RLS admin et accès de service.
   - Ajouter les fonctions serveur protégées pour statut, lancement manuel et téléchargement signé.
4. **Automatisation**
   - Ajouter une route cron sécurisée par secret partagé, garde Europe/Paris et idempotence hebdomadaire.
   - Enregistrer chaque succès/échec, notifier les admins en cas d’échec, puis appliquer la rotation seulement après upload réussi.
5. **Administration**
   - Ajouter « Backup PP CA » dans Configuration → Administration.
   - Afficher statut, prochaine exécution, deux copies, téléchargement et lancement manuel.
6. **Finitions et validation**
   - Ajouter le changelog et corriger les deux incompatibilités TypeScript déjà présentes après la mise à jour TanStack.
   - Exécuter formatage, typecheck, lint, tests et build.
   - Lancer un backup manuel réel, télécharger et contrôler ouverture, formules, couleurs, structure et concordance des totaux avec `/pilot/ca`.

## Point nécessitant votre action
Le secret du cron restera dans les Secrets du projet et ne sera jamais exposé dans l’application. S’il ne peut pas être créé automatiquement, je vous indiquerai précisément le nom à renseigner.
