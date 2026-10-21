# Indicateurs — source officielle et recalculs constatés

Référence : `src/lib/pilot-kpi-contract.ts` (contrat de vérité, documentation seulement).
Constat du 21/10/2026 — **aucun calcul modifié** : ce document sert à décider quoi consolider.

| Indicateur | Source officielle | Autres endroits qui le recalculent |
| --- | --- | --- |
| Marge % (bénéfice ÷ CA) | `pilot-engine.ts` (`margePct`, exige des charges complètes) | `pilot.ts` (moteur historique, 0 si CA nul), `pilot-annual.ts`, `pilot-direction-view.ts`, `pilot-decision-brief.ts`, `pilot-reconciliation.ts`, `pilot.charges.tsx` |
| Marge SST % | `sst-analytics.ts` → `computeMissionFinancials` | 3 formules identiques dans le même fichier (missions, groupes, totaux) |
| Taux horaire (CA ÷ heures) | `pilot-sale-time.ts` / `pilot-ca-hourly-rate.ts` | `pilot-ca.ts`, `pilot.ts`, `ceev-live.ts`, `CeevLivePanel.tsx`, `pilot.ceev-live.tsx`, `pilot-reliability.ts`, `adpp-context.server.ts`, `pilot-director-insights.ts` |

## Points de vigilance
- Le moteur historique (`pilot.ts`) et le moteur actuel (`pilot-engine.ts`) coexistent : même indicateur, périmètres différents (valeur 0 ou « — » en l'absence de données).
- Les taux horaires n'ont pas tous le même dénominateur (heures vendues, réelles, confirmées).

## Décision à prendre avant consolidation
1. Quel moteur fait foi pour chaque indicateur (valeurs actuelles à comparer page par page) ?
2. Règle commune en l'absence de données : « — » (recommandé) ou 0.
