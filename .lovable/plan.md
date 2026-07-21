
# Pilot Pro v1.1 — Reconnexion des données métier

Objectif : brancher les écrans existants sur les données déjà saisies (CA 2026, interventions, CR, clients). Aucune nouvelle table, aucun écran décoratif, priorité aux liens actionnables.

---

## PHASE 1 — Source client consolidée (`src/lib/client-360.ts` — nouveau, léger)

Créer un helper unique `getClient360(clientId | ca_key)` qui agrège en une seule passe :
- `clients` (identité) + fallback `pilot_ca_entries.client_name` (clients CA-only)
- `pilot_ca_entries` → CA cumulé, CA annuel, historique prestations vendues, dernière vente
- `interventions` (statut `termine`) → nb interventions, temps total réel (`hours_spent`), dernière intervention, prestations réalisées
- Calculs dérivés : taux horaire réel = CA total / heures confirmées, fréquence (interventions/an), prestations distinctes

Un seul fetcher `getAllClient360()` pour les listes (Direction, Cockpit, Clients). Réutilise `fetchConfirmedHoursByClient` et `client-score`.

**Cas clients CA-only** : clé stable `ca:${slug(client_name)}` quand `client_id` est nul, exposée dans les listes.

---

## PHASE 2 — Cockpit Aujourd'hui décisionnel (`pilot.index.tsx` + nouvelle route `pilot.focus.$topic.tsx`)

Chaque carte "Décisions / Actions prioritaires" devient un lien vers `/pilot/focus/$topic` avec la liste filtrée :

Topics couverts :
- `chronophages` — clients A/B avec taux horaire réel < 85 % de la cible (nom, CA, heures, €/h réel, raison)
- `cr-non-envoyes` — interventions `termine` sans `sent_to_client_at`
- `heures-manquantes` — interventions sans `hours_spent` ou estimées
- `recos-a-planifier` — recos `acceptee` sans `planned_intervention_id`
- `opportunites` — clients avec offres NBO ≥ 80 (avec justification depuis la vue)
- `dormants` — clients sans activité > 365 j
- `depassements-temps` — interventions > 150 % moyenne du type
- `creation-sans-entretien` / `entretien-sans-conseil` — croisements familles CA

Route `pilot.focus.$topic.tsx` : un composant unique qui, selon `$topic`, réutilise les calculs déjà faits dans `pilot.index.tsx` (extraits dans `src/lib/pilot-focus.ts`) et affiche un tableau standard (Client → Fiche 360, colonnes contextuelles, raison de l'alerte).

Supprimer les redirections génériques vers `/pilot/direction` ou `/interventions` depuis les cartes actions.

---

## PHASE 3 — Fiche client 360 explicable (`pilot.fiche.$clientId.tsx` + `client-score.ts`)

Enrichir `ClientScore` avec un `scoreBreakdown` :
```
{
  rentabilite: { value: 0-30, max: 30, note: "..." },
  relation:    { value: 0-25, max: 25, note: "..." },
  potentiel:   { value: 0-25, max: 25, note: "..." },
  recence:     { value: 0-20, max: 20, note: "..." },
  total: 0-100,
  strengths: string[],
  weaknesses: string[],
  recommendedAction: string,
}
```

Composantes :
- **Rentabilité (30)** : ratio réel / cible (0.6→0, 1.0→30, saturé à 1.2)
- **Relation (25)** : nb interventions année + fréquence
- **Potentiel (25)** : opportunités NBO (score + valeur estimée)
- **Récence (20)** : jours depuis dernière intervention (0j→20, 365j→0)

Bloc UI sur la fiche : note globale + 4 barres composantes + listes "Points forts" / "Points faibles" / "Action recommandée" (déjà présente, gardée).

---

## PHASE 4 — Opportunités commerciales justifiées

Composant `<OpportunityCard>` réutilisé dans Cockpit, Direction et Fiche 360, alimenté par `v_client_next_best_offers` :
- Client (link fiche)
- Prestation suggérée
- Trigger data : familles présentes/absentes, dernière vente famille, CA client, heures totales
- Valeur potentielle (via `service_prices` moyens ou `estimated_value` de la vue)
- Bouton "Créer une recommandation"

Le focus `opportunites` liste toutes les offres ≥ 60 avec justification textuelle générée côté client (pas de nouvelle table).

---

## PHASE 5 — Analyse économique (extension `pilot.finance.tsx`)

Deux nouvelles sections branchées uniquement sur données existantes :

**Par client** — tableau (top 20 par CA) :
- CA, heures réelles, €/h réel, évolution N vs N-1 (via `pilot_ca_entries`), top 2 prestations contributives

**Par prestation** — agrégation sur `pilot_ca_entries` (colonne `family` + libellé) :
- CA généré, heures consommées (via `intervention_tasks.service_id` quand présent, fallback moyenne famille), €/h réel

Aucune nouvelle table : les prestations sont dérivées des libellés/famille CA + `services` existant.

---

## Impacts fichiers (résumé)

**Nouveaux** :
- `src/lib/client-360.ts` — agrégat unique
- `src/lib/pilot-focus.ts` — extractions des filtres du cockpit
- `src/routes/_authenticated/pilot.focus.$topic.tsx` — page listes actionnables

**Modifiés** :
- `src/lib/client-score.ts` — ajout `scoreBreakdown` + reco
- `src/routes/_authenticated/pilot.index.tsx` — cartes → liens focus
- `src/routes/_authenticated/pilot.fiche.$clientId.tsx` — bloc composantes + opportunités enrichies
- `src/routes/_authenticated/pilot.direction.tsx` — réutilise `getAllClient360`
- `src/routes/_authenticated/pilot.finance.tsx` — sections analyse par client / prestation
- Nouveau composant `src/components/pilot/OpportunityCard.tsx`

**Aucune migration SQL**. Typecheck obligatoire en fin de chaque phase.

---

## Livraison

Chaque phase = un lot cohérent. Je livre les 5 en séquence dans cette session (Phase 1 → 5), avec `bunx tsgo --noEmit` à la fin, puis un rapport récap des fichiers touchés.

Ok pour démarrer sur cette base ?
