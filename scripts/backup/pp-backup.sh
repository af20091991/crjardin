#!/usr/bin/env bash
# Sauvegardes PP sur O2switch, dans un dossier dédié.
#   daily  : données essentielles (CA, clients, SST, comptes) — 30 derniers jours conservés
#   weekly : base complète (pg_dump) — 12 dernières semaines conservées
# Usage : pp-backup.sh daily|weekly
# Le fichier d'environnement (droits 600) contient PP_DB_URL et PP_BACKUP_DIR. Il ne vit
# jamais dans le dépôt.
set -euo pipefail

MODE="${1:?usage: pp-backup.sh daily|weekly}"
ENV_FILE="${PP_BACKUP_ENV:-$HOME/.config/pp-backup.env}"
# shellcheck disable=SC1090
source "$ENV_FILE"
: "${PP_DB_URL:?PP_DB_URL manquant}"
: "${PP_BACKUP_DIR:?PP_BACKUP_DIR manquant}"

STAMP="$(date +%Y%m%d-%H%M)"
LOG="$PP_BACKUP_DIR/backup.log"
mkdir -p "$PP_BACKUP_DIR/daily" "$PP_BACKUP_DIR/weekly"
log() { echo "$(date -Iseconds) [$MODE] $*" >> "$LOG"; }

# Tables « essentielles » (mode daily)
DAILY_TABLES=(
  # Chiffre d'affaires
  pilot_ca_entries pilot_hours pilot_historic_hours pilot_goals pilot_settings
  pilot_tjm_settings pilot_fixed_charges charges_one_off charges_recurring
  charges_variable_rates charge_categories pilot_charge_categories
  # Toutes données clients
  clients contacts contact_sites sites site_aliases client_merge_log favorite_clients
  interventions intervention_tasks intervention_report_history intervention_photos
  recommendations client_messages client_premium client_premium_documents
  client_photo_albums share_access_log
  # Toutes rubriques SST
  subcontractors subcontractor_missions subcontractor_mission_photos sst_lists
  sst_availability_calendar sst_audit_log pilot_sst_label_map calendar_participants
  planning_notes
  # Comptes clients, prestataires, admin
  profiles user_roles admin_audit_log
)

if [[ "$MODE" == "daily" ]]; then
  OUT="$PP_BACKUP_DIR/daily/pp-daily-$STAMP.dump"
  ARGS=(--schema=public --no-owner --format=custom)
  for t in "${DAILY_TABLES[@]}"; do ARGS+=(--table="public.$t"); done
  # Comptes d'authentification (adresses, identifiants) : schéma auth
  pg_dump "${ARGS[@]}" --file="$OUT" "$PP_DB_URL"
  pg_dump --schema=auth --table=auth.users --no-owner --format=custom \
    --file="$OUT.auth" "$PP_DB_URL"
  find "$PP_BACKUP_DIR/daily" -name 'pp-daily-*' -mtime +30 -delete
  find "$PP_BACKUP_DIR/daily" -name 'pp-daily-*.auth' -mtime +30 -delete
  log "ok $OUT"
elif [[ "$MODE" == "weekly" ]]; then
  OUT="$PP_BACKUP_DIR/weekly/pp-full-$STAMP.dump"
  pg_dump --no-owner --format=custom --file="$OUT" "$PP_DB_URL"
  find "$PP_BACKUP_DIR/weekly" -name 'pp-full-*' -mtime +84 -delete
  log "ok $OUT"
else
  echo "mode inconnu : $MODE" >&2
  exit 2
fi
