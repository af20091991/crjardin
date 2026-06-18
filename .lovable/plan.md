## Améliorations à implémenter

Je regroupe les 10 points choisis en 4 lots cohérents. Chaque lot est livré et vérifiable.

### Lot A — Saisie & lecture rapides (points 3, 8, 12)

- **3. Tâches favorites par utilisateur** : nouvelle liste personnelle de tâches favorites, gérable depuis l'écran « Nouveau compte-rendu ». Tes favoris apparaissent en premier dans les puces de sélection, en plus des tâches courantes.
- **8. Recherche globale sur le tableau de bord** : un champ de recherche en haut du dashboard qui filtre instantanément clients et interventions (par nom de client, type, référence).
- **12. Titre auto-généré** : chaque compte-rendu reçoit un titre lisible incluant le **nom du client + le mois d'intervention** (ex. « Dupont — Tonte & taille · Mai 2026 »), affiché partout (listes, détail, PDF).

### Lot B — Référencement & alertes (points 10, 18, 19)

- **19. Numérotation automatique** : chaque compte-rendu reçoit une référence unique type **CR-2026-00142** (compteur annuel par utilisateur), affichée dans l'app et le PDF.
- **10. Badge d'alerte client** : un badge orange « Préco. en attente +30 j » sur la fiche et la liste client quand une préconisation est en attente depuis plus de 30 jours.
- **18. Centre d'alertes (dashboard)** : un encart listant les brouillons anciens (compte-rendu non finalisé depuis X jours) et les préconisations en attente arrivant à expiration. (Alertes in-app ; pas d'email/push réel, qui nécessiterait une config dédiée — je peux l'ajouter ensuite si tu veux.)

### Lot C — Intelligence commerciale (points 15, 17)

- **15. Prix estimé par préconisation, positionnement Premium** : chaque préconisation peut porter une estimation d'heures de main-d'œuvre, valorisée à **70 € TTC/h** (taux par défaut, modifiable). Le montant estimé s'affiche sur la préco et dans le PDF.
- **17. KPI commerciaux (dashboard)** : chiffre d'affaires potentiel (somme des préco en attente), CA accepté, et taux de conversion des préconisations.

### Lot D — IA photo & signature (points 13, 20)

- **13. Analyse IA des photos** : un bouton « Analyser les photos » envoie les clichés du chantier à l'IA, qui propose des préconisations (maladies, adventices, arbres morts, etc.). Chaque suggestion est présentée **individuellement** avec Accepter / Ignorer, pour vérifier et corriger les éventuelles erreurs de l'IA avant enregistrement.
- **20. Signature de l'auteur** : seul **l'auteur de la fiche** signe. Chaque auteur dessine sa signature **une seule fois** (mémorisée sur son profil) ; elle est ensuite **réutilisée automatiquement** sur chaque PDF. Possibilité de la redessiner à tout moment.

## Détails techniques

**Base de données (migrations)**
- `favorite_tasks` (user_id, label) + RLS + GRANT.
- `interventions` : ajout `title text`, `reference text`.
- `recommendations` : ajout `estimated_hours numeric`, `unit_price numeric` (défaut 70), `source text` (manuel/ia_photo).
- `profiles` : ajout `signature_data text` (PNG base64), `hourly_rate numeric` (défaut 70).
- Numérotation : fonction Postgres `next_intervention_reference(user)` générant `CR-AAAA-NNNNN` via table compteur, appelée à la création.

**Côté code**
- `src/lib/favorites.ts`, `src/lib/profile.ts`, extensions de `src/lib/interventions.ts` et `src/lib/garden.ts`.
- Nouveau server fn `analyzeInterventionPhotos` (multimodal, Lovable AI) dans `ai.functions.ts`.
- Composant `SignaturePad` (canvas tactile) réutilisable.
- Mise à jour `intervention-pdf.ts` (référence, titre, prix, signature auteur).
- Dashboard : recherche, KPI, centre d'alertes.

Je construis les lots A → D successivement, en vérifiant chaque étape.
