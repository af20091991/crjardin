# Plan — remplacer le Centre de décision par Dashboard

## Objectif
Transformer la page d'accueil Pilot Pro (`/pilot`) en page **Dashboard**, inspirée du modèle fourni : vue dense, lisible, en cartes et graphiques, sans modifier les règles métier ni les calculs existants.

## Ce qui sera modifié
- Renommer l'entrée de menu **Centre de décision** en **Dashboard**.
- Recomposer la page `/pilot` autour de blocs opérationnels : CA, Site web, temps/rentabilité, charges variables, clients, notifications CR, objectifs, SST.
- Réutiliser les données PP existantes, sans données fictives.
- Garder le style PP actuel : sobre, clair, responsive, tokens existants.

## Contenu prévu du Dashboard
1. **Chiffre d'affaires du mois**
   - CA du mois en cours.
   - Charges du mois.
   - Bénéfice attendu du mois = CA − charges.
   - Interventions et heures sur le même périmètre.

2. **Site web**
   - Positionnement local par communes autour de Montpellier, si les données Google sont disponibles.
   - Mots-clés en hausse et en baisse, issus des données de recherche disponibles.
   - État clair si Google ne renvoie pas de données.

3. **Temps, marge horaire et rentabilité prestation**
   - Heures du mois / année.
   - Taux horaire réel.
   - Diagramme de rentabilité par prestation avec les données existantes.

4. **Charges variables depuis 2020**
   - Histogramme par année pour les catégories variables prioritaires : Alimentaire, Carburant, Déchèterie.

5. **Clients**
   - Top 3 clients rentables du mois.
   - Top 3 clients rentables de l'année en cours.

6. **Notifications CR Chantier**
   - Encart dédié aux notifications liées aux interactions client : annotation, CR lu, préconisation, message client.

7. **Objectifs**
   - Prochains objectifs à accomplir avec échéance.

8. **SST**
   - Total SST de l'année.
   - Nombre d'heures sous-traitées de l'année.

## Contraintes respectées
- Pas de modification des calculs CA, heures, rentabilité, marge ou règles métier.
- Pas de modification de `roadmap.md` ni de `src/lib/changelog.ts`.
- Pas de données inventées : les blocs sans source affichent un état indisponible ou insuffisant.
- Diff limité aux fichiers nécessaires.

## Vérification
- Vérifier TypeScript après modification.
- Vérifier les tests pertinents.
- Vérifier l'état de build observé par la prévisualisation avant de conclure.
