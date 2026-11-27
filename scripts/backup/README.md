# Sauvegardes PP (O2switch)

## Installation (une fois, sur O2switch)

1. Copier `pp-backup.sh` dans `/home/foan8002/pp-backup.sh` et le rendre exécutable (`chmod 755`).
2. Créer `~/.config/pp-backup.env` (droits `600`) :

   ```
   PP_DB_URL='postgresql://…'   # chaîne de connexion Postgres Supabase (ne jamais la committer)
   PP_BACKUP_DIR='/home/foan8002/backups-pp'
   ```

3. Vérifier que `pg_dump` est disponible (`pg_dump --version`). Version à utiliser : 15 ou plus.
4. Lancer une fois à la main : `/home/foan8002/pp-backup.sh daily`, puis `weekly`.
5. Ajouter les lignes de `crontab.txt` à la crontab (`crontab -e`).

## Contenu

- **daily** : tables essentielles (chiffre d'affaires, données clients, SST, comptes) + table `auth.users`. Conservation 30 jours.
- **weekly** : base complète (`pg_dump` de tout le schéma `public`, hors schéma `auth`). Conservation 12 semaines.

Les photos et documents stockés dans Supabase Storage ne sont pas dans le dump : ils restent à sauvegarder séparément si vous voulez une reconstruction totale.

## Journal

Chaque exécution ajoute une ligne dans `backup.log`, dans le dossier de sauvegarde.
