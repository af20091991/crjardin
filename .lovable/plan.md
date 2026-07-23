# Pilot Pro v2 — Étape 1.1 : Rapprochement CA ↔ clients

## 1. Fichiers créés / modifiés

**Créés**
- `src/lib/pilot-ca-matching.ts` — logique de suggestion (similarité nom, historique désignation→client), acceptation/refus, journalisation.
- `src/routes/_authenticated/pilot.rapprochement.tsx` — interface de rapprochement assisté (liste orphelines + panneau suggestions).
- Migration SQL : nouvelle table `pilot_ca_match_log` (journal des décisions) + fonction RPC `link_ca_entry_to_client(entry_id, client_id, method, note)` en `security definer` qui **n'écrit que `client_id`** et insère le log.

**Modifiés**
- `src/routes/_authenticated/pilot.parametres.tsx` — carte "Rapprochement CA" avec compteur d'orphelines + lien vers l'écran.
- `src/components/AppShell.tsx` — entrée menu sous Pilotage (visible admin uniquement).

Aucun changement sur `pilot_ca_entries` en dehors de `client_id`. `pilot.ts` (calcul) reste intact.

## 2. Schéma technique

**Table `pilot_ca_match_log`**
```
id uuid pk
entry_id uuid → pilot_ca_entries(id)
previous_client_id uuid null
new_client_id uuid null
method text  -- 'manual' | 'suggestion' | 'refused' | 'reverted' | 'new_client'
score numeric null
decided_by uuid → auth.users(id)
decided_at timestamptz default now()
note text null
```
RLS : lecture/écriture réservées à l'utilisateur propriétaire des entrées ; GRANT authenticated + service_role.

**RPC `link_ca_entry_to_client`**
- Vérifie que l'entrée appartient à `auth.uid()`.
- Vérifie que `client_id` cible appartient au même user (ou NULL pour "refusé").
- UPDATE `pilot_ca_entries SET client_id = $2` (jamais amount/date/category/designation).
- INSERT dans `pilot_ca_match_log`.
- Retourne la ligne mise à jour.

**Suggestions (côté client, sans SQL lourd)**
1. Cache des désignations déjà rattachées : `designation → client_id` fréquent → suggestion "historique" (score 0.9+).
2. Similarité fuzzy (Dice / trigram JS) entre `designation` et `client.name` (+ `civility`) → score 0..1.
3. Tri décroissant, top 5, seuil affichage ≥ 0.35.

## 3. Fonctionnement de validation

Écran `/pilot/rapprochement` :
- Liste paginée des lignes CA avec `client_id IS NULL` (filtres : année, catégorie, montant min, recherche texte).
- Ligne sélectionnée → panneau latéral :
  - Détails **en lecture seule** : désignation, montant HT, mois/année, catégorie, heures, note.
  - Suggestions (top 5) avec score et raison ("historique désignation", "similarité nom").
  - Actions :
    - **Associer** → appelle RPC (`method='suggestion'` ou `'manual'`).
    - **Refuser / Ignorer** → RPC avec `new_client_id=null, method='refused'` (marque décidé sans muter la ligne).
    - **Rechercher un client** (combobox sur `clients`).
    - **Créer un client** (ouvre `ClientForm` existant ; à la création, propose association immédiate).
  - **Annuler la dernière décision** : nouveau log `reverted` + restauration `previous_client_id`.
- Historique des 20 dernières décisions consultable en bas d'écran.
- Aucune action en masse « auto ». Un bouton « Appliquer toutes les suggestions ≥ 0.9 » **désactivé par défaut**, verrou explicite + confirmation, chaque application génère un log individuel.

## 4. Risques identifiés

| Risque | Mitigation |
|---|---|
| Faux positif de similarité rattache la mauvaise ligne | Validation unitaire obligatoire ; bulk verrouillé ; annulation par log. |
| Perte d'historique / audit | Table `pilot_ca_match_log` insert-only ; jamais de DELETE. |
| Mutation involontaire d'`amount`/`date`/`category` | RPC dédiée qui n'update **que** `client_id` ; pas d'UPDATE côté client. |
| Rattachement à un client d'un autre user | RPC vérifie ownership des deux côtés. |
| Recalculs (Fiche 360, portefeuille) faussés pendant l'opération | Invalidation React Query ciblée (`pilot-ca-entries`, `client-scores`) après chaque décision. |
| Charge cognitive sur 330 lignes | Filtres + tri par score ; possibilité de traiter par lots (par année/catégorie). |

## 5. Ce qui ne change pas

- Aucun recalcul rétroactif de CA/marge.
- Aucune modification de `pilot.ts`, `pilot.index.tsx`, fiches 360.
- Aucune suppression de ligne.
- Les lignes refusées restent visibles (filtrables) ; elles peuvent être ré-ouvertes plus tard.

---

En attente de validation avant implémentation.
