# Phase 3 — Modules SST & Compte-rendu client

## 1. Analyse de l'architecture actuelle

### Modules déjà en place
- **Clients** (`clients`) : fiche complète, emails multiples, `share_token`, jardin associé.
- **Interventions** (`interventions` + `intervention_tasks` + `intervention_photos`) : CR de chantier existant avec `summary`, `garden_state`, `upcoming_works`, `recommendations_text`, statut brouillon/terminé, référence auto `CR-YYYY-NNNNN`, lecture client trackée, partage via `share_token`.
- **Fiches chantier** (`worksite_sheets`) : préparation intervention (équipement, EPI, plan jardin, déchèterie).
- **Recommandations** (`recommendations`), **Santé jardin** (`garden_health`), **Messages client** (`client_messages`).
- **Pilot Pro** : `pilot_ca_entries` (source unique CA), `pilot_charges`, `pilot_goals`, `pilot_hours`, `pilot_tjm_settings`, `pilot_client_notes`, `pilot_settings`.
- **Référentiel économique (Phase 2a)** : `service_categories`, `services`, `service_prices`, `service_seasonality`, `time_categories`, `time_standards`, `charge_categories`, `charges_recurring`, `charges_variable_rates`, `charges_one_off` — créés, non peuplés.
- **PDF** : `intervention-pdf.ts`, `worksite-pdf.ts`, `share-pdf.ts`, `period-report.ts`.

### Constat clé pour les 2 nouveaux modules
- **Compte-rendu client** : la table `interventions` couvre déjà 90 % du besoin (identité, date, travaux via `intervention_tasks`, observations, photos, état, recommandations, partage). Le module `RapportChantier.tsx` + `intervention-pdf.ts` produisent déjà un PDF pro. **→ Pas de nouvelle table. On enrichit l'existant.**
- **SST** : aucune structure existante. **→ 2 nouvelles tables à créer** (`subcontractors`, `subcontractor_missions`) réutilisant `intervention_photos` pour les pièces jointes.

### Doublons / incohérences restantes (non bloquants)
- `pilot_charges` coexiste avec `charges_recurring/variable_rates/one_off` (Phase 2a) — migration prévue plus tard, pas dans cette phase.
- `recommendations` et `interventions.recommendations_text` cohabitent — OK, usages distincts.

---

## 2. Modifications base de données

### Module SST — nouvelles tables

**`subcontractors`** (carnet SST)
- `id`, `user_id` (owner), `name`, `company`, `email`, `phone`, `address`
- `specialties text[]` (élagage, maçonnerie, terrassement, irrigation…)
- `hourly_rate numeric`, `notes text`, `active boolean`
- `created_at`, `updated_at`

**`subcontractor_missions`** (missions confiées)
- `id`, `user_id`, `subcontractor_id` → `subcontractors`
- `client_id` → `clients`, `worksite_sheet_id` → `worksite_sheets` (nullable)
- `mission_date date`, `service_requested text`, `instructions text`
- `status` : `planned | in_progress | done | done_with_issues | problem | impossible`
- `report_notes text` (retour SST), `anomalies text`, `recommendations text`
- `agreed_price numeric`, `invoiced_amount numeric`
- `created_at`, `updated_at`

**`subcontractor_mission_photos`** (documents & photos)
- `id`, `user_id`, `mission_id` → `subcontractor_missions`
- `storage_path`, `caption`, `kind` (`briefing` | `report`), `position`
- `created_at`

Toutes avec RLS `auth.uid() = user_id`, GRANTs authenticated + service_role, triggers `updated_at`. Bucket storage réutilisé : `chantier-photos` (nouveau préfixe `sst/`).

### Module Compte-rendu client — enrichissement `interventions`
Aucune nouvelle table. Colonnes ajoutées si besoin après validation :
- `technical_observations text` (distinct de `garden_state`, orienté diagnostic pro)
- `attention_points text`
- `suggested_services text[]` (préparer futures ventes additionnelles)
- `archived_pdf_path text` (archivage auto du PDF généré dans storage)

---

## 3. Plan d'implémentation par étapes

### Étape A — Fondations SST (backend)
1. Migration : 3 tables + RLS + GRANTs + triggers `updated_at`.
2. Lib `src/lib/subcontractors.ts` : CRUD SST + missions + photos (typé, sans `as never`).
3. Route `/sst` sous `_authenticated` avec 2 onglets (Carnet SST / Missions).

### Étape B — UI SST
1. `SubcontractorList.tsx` + `SubcontractorForm.tsx` : carnet avec spécialités, historique par SST.
2. `MissionList.tsx` + `MissionForm.tsx` : création mission liée client + fiche chantier, upload documents briefing.
3. `MissionReport.tsx` : retour d'intervention (statut, photos, anomalies, recommandations).
4. Entrée sidebar « Sous-traitants » (icône `HardHat`).

### Étape C — Enrichissement Compte-rendu client
1. Migration additive (colonnes optionnelles sur `interventions`) — après validation.
2. Extension `RapportChantier.tsx` : sections « Observations techniques », « Points d'attention », « Prestations complémentaires suggérées ».
3. Refonte légère `intervention-pdf.ts` : structure pro (identité entreprise depuis `profiles`/`pilot_settings`, sections claires, recos saisonnières auto depuis `service_seasonality` quand catalogue peuplé).
4. Archivage auto : bouton « Finaliser » → génère PDF → upload storage → stocke `archived_pdf_path` → affichable dans fiche client.
5. Envoi client : réutilise l'infra email existante (`email/send.ts`).

### Étape D — Préparation ventes additionnelles (fondations seulement)
- Structure `suggested_services` prête à recevoir des propositions IA plus tard.
- Pas de logique IA dans cette phase.

### Ordre proposé
**A → B → C → D**, chaque étape validée avant la suivante. Étape A peut démarrer immédiatement après validation du schéma SST.

---

## 4. Questions avant écriture

1. **SST — spécialités** : liste libre (`text[]`) ou enum figé (élagage, maçonnerie, terrassement, irrigation, entretien, autre) ?
2. **SST — facturation** : garder `agreed_price` + `invoiced_amount` pour préparer marge SST future, ou minimal (aucun montant) ?
3. **CR client — nouvelles colonnes** sur `interventions` : je les ajoute toutes (`technical_observations`, `attention_points`, `suggested_services`, `archived_pdf_path`) ou tu préfères commencer par un sous-ensemble ?
4. **Archivage PDF** : bucket dédié `intervention-reports` (privé) ou réutiliser `chantier-photos` avec préfixe `reports/` ?
5. **Ordre de livraison** : je commence par Étape A (SST backend) ou par Étape C (enrichissement CR client) ?

Aucune modification n'a été effectuée. En attente de tes réponses pour lancer l'étape validée.
