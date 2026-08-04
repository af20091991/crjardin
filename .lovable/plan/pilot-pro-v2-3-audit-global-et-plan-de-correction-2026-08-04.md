# Pilot Pro V2.3+ — Audit global et plan de correction

Audit réalisé en lecture seule sur la base réelle. Aucune donnée modifiée, aucune fusion, aucune suppression.

## 1. Photographie des données (état réel)

| Domaine | Volume | Observation |
|---|---|---|
| Clients | 264 | 0 doublon de nom, 0 fiche fusionnée, 0 client sans activité |
| Sites | 22 (53 alias) | issus des 22 validations manuelles déjà tracées |
| Contacts | 0 | aucun contact créé à ce jour |
| Lignes CA/charges | 2 042 (2020→2026) | 959 sans client (47 %), 1 906 sans site (93 %) |
| Interventions | 16 dont 15 terminées | 15 terminées sans heures saisies |
| Heures historiques | 22 lignes | toutes rattachées à un client, 4 à un site |
| Ledger heures | 10 lignes | usage marginal |
| Charges (nouvelles tables) | 0 ligne | charges_recurring / one_off / variable_rates vides |
| Charges legacy `pilot_fixed_charges` | 12 lignes (2026) | table encore lue par l'UI |
| SST | 12 missions, 4 prestataires | 7 missions sans client |
| CEEV | 22 contrats | — |
| Journal rapprochement | 1 031 entrées | traçabilité correcte |

Ventes/charges par exercice : 2020 = 27 669 € de ventes **et 0 charge** ; 2021→2026 renseignés des deux côtés ; `remuneration` présente uniquement en 2026 (45 000 €).

## 2. Anomalies détectées

### 🔴 Critique — peut fausser les décisions

1. **Bénéfice 2020 structurellement faux.** 12 lignes de ventes, aucune charge → `annualSummary()` affiche un bénéfice = CA (100 % de marge) et ce chiffre alimente le Conseiller (CAGR), la Direction et les projections.
   Fichier : `src/lib/pilot-annual.ts`, `src/lib/pilot-advisor.ts` — table `pilot_ca_entries`.
2. **511 lignes de charges `a_classer` (109 747 €).** Elles entrent dans le total des charges mais ne sont ni fixes ni variables → le split fixe/variable, le seuil de rentabilité et le TJM reposent sur une base incomplète.
   Fichier : `src/lib/pilot-charges.ts`, page `/pilot/charges`.
3. **Double source de charges fixes.** `pilot_fixed_charges` (12 lignes 2026, mensuelles) est toujours affichée dans `/pilot/ca` et `/pilot/charges` alors que les mêmes charges existent dans `pilot_ca_entries`. Risque de double comptage à la lecture humaine et de divergence entre deux écrans.
   Fichiers : `src/components/pilot/FixedChargesPanel.tsx`, `src/lib/pilot-fixed-charges.ts`.
4. **Rémunération comptée deux fois selon le chemin.** `kind='remuneration'` (45 000 € en 2026) est exclu par `pilot-ca.ts` mais `splitRemuneration()` re-détecte aussi des libellés de rémunération dans les charges : selon l'écran, la rémunération peut être comptée une fois, deux fois, ou majorée de 45 % de cotisations.
   Fichiers : `src/lib/pilot-remuneration.ts`, `src/lib/pilot-charges.ts`.

### 🟠 Important — dégrade la qualité des données

5. **945 lignes `non_identifie` (472 846 €)** côté rapprochement, dont 959 sans `client_id` → rentabilité client calculée sur une fraction du CA. Aucune correction automatique possible : nécessite le centre de rapprochement.
6. **15 interventions terminées sur 15 sans `hours_spent`** → « taux horaire réel » indisponible partout (comportement voulu par `pilot-reliability.ts`, mais l'utilisateur n'a aucune alerte d'action claire).
7. **7 missions SST sans client** → module Rentabilité SST partiellement aveugle sur la marge par client.
8. **Les nouvelles tables de charges (`charges_recurring`, `charges_one_off`, `charges_variable_rates`) sont vides** : structures créées mais jamais alimentées → code mort, source de confusion sur « quelle est la vraie table ».

### 🟡 Amélioration

9. **1 doublon exact** (même année/mois/désignation/montant) — 2 lignes concernées, à confirmer manuellement (peut être légitime).
10. **0 contact en base** alors que le CR s'appuie sur `report-recipient.ts` : tous les comptes-rendus retombent sur le fallback client → risque de civilité incorrecte non détectée.
11. **1 840 lignes sans catégorie métier** (vs 93 SAP / 81 CEEV / 23 AP) : les analyses par catégorie ne couvrent que 10 % des lignes.
12. **`pilot_metric_snapshots` et `pilot_edit_log` vides** : anti-régression et journal d'édition en place mais jamais utilisés → aucun point de comparaison historique.

### 🟢 Cosmétique

13. Modèle Client/Site : 93 % du CA n'a pas de `site_id`. C'est conforme à la décision de ne pas migrer, mais les écrans ne l'indiquent pas → un utilisateur peut croire que l'analyse par site est complète.

## 3. Plan de correction proposé

### Priorité 1 — fiabilité des décisions (lot A)
- **A1** — Exclure des synthèses/CAGR tout exercice dont les charges sont absentes ; l'afficher comme « exercice incomplet » plutôt qu'avec 100 % de marge. `src/lib/pilot-annual.ts`, `src/lib/pilot-advisor.ts`. Risque : nul (affichage). Aucune donnée touchée.
- **A2** — Unifier la rémunération sur une seule règle : `kind='remuneration'` = source unique, `splitRemuneration()` ne re-détecte plus les libellés déjà typés. `src/lib/pilot-remuneration.ts`, `src/lib/pilot-charges.ts`. Risque : variation attendue des totaux de charges → snapshot anti-régression avant/après.
- **A3** — Retirer `FixedChargesPanel` (legacy) de `/pilot/ca` et `/pilot/charges`, avec bandeau « source unique : Classeur CA/charges ». Table `pilot_fixed_charges` **conservée** (aucune suppression).
- **A4** — Rendre visible l'impact des 511 lignes `a_classer` : bandeau chiffré + accès direct au classement, et affichage du total de charges comme « au moins X € » tant que le classement est incomplet.

### Priorité 2 — qualité des données (lot B)
- **B1** — Alerte actionnable « 15 interventions terminées sans heures » sur Aujourd'hui, avec lien direct vers la saisie.
- **B2** — Bloc « 7 missions SST sans client » dans le module SST, rattachement manuel uniquement.
- **B3** — Marquer explicitement `charges_recurring` / `charges_one_off` / `charges_variable_rates` comme non utilisées (ou les retirer du code de lecture) pour supprimer l'ambiguïté de source.
- **B4** — Signaler le doublon exact détecté dans le Centre de validation, sans suppression automatique.
- **B5** — Créer un premier snapshot anti-régression (`pilot_metric_snapshots`) avant le lot A afin d'avoir une référence chiffrée.

### Priorité 3 — ergonomie (lot C)
- **C1** — Indicateur de couverture « analyse par site » sur les écrans concernés (X % du CA rattaché à un site).
- **C2** — Rappel de complétude des catégories métier dans le Centre de qualité.

## 4. Garanties

- Aucune donnée supprimée, aucune fusion appliquée pendant l'audit.
- Toute correction du lot A est encadrée par un snapshot de référence avant/après.
- Les tables legacy sont neutralisées côté lecture, jamais supprimées.
