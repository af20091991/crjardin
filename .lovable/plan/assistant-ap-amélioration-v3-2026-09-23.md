# Assistant AP — amélioration V3

## Objectif
Améliorer uniquement l’ergonomie d’**Assistant AP** afin de faire ressortir les actions utiles avant les détails, sans modifier les données, les règles métier, les accès ni les autres modules.

## Périmètre
- Modifier uniquement `src/routes/_authenticated/pilot.assistant-ap.tsx` si possible.
- Réutiliser les données déjà chargées par `listApWorksites` et `listApSuppliers`, ainsi que les calculs existants (`worksiteGlobalState`, `worksiteCounts`, `apEvents`, etc.).
- Aucun changement de table, migration, RLS, API, dépendance, menu ou autre module.
- Conserver les onglets **Calendrier**, **Fournisseurs** et **À relancer** dans leur fonctionnement actuel.

## Vue Chantiers
- Ajouter un sélecteur visible **Cartes / Tableau** ; **Cartes** reste la valeur par défaut.
- Mémoriser le choix localement dans le navigateur, sans requête ni donnée en base.
- Conserver les filtres métier existants et les faire fonctionner dans les deux modes.
- Afficher les cartes dans une grille responsive : 1 colonne sur mobile, adaptation sur tablette et 5 colonnes à partir du format ordinateur prévu par Pilot Pro.
- Limiter chaque carte à : chantier, date, état, fournitures prêtes sur total, éléments à traiter et relances lorsqu’il y en a.
- Ajouter une vue tableau synthétique : chantier, date, état, fournitures, relances.

## Fiche chantier hiérarchisée
- Ouvrir une seule fiche à la fois directement dans la page, jamais dans une grande fenêtre.
- Afficher d’abord un résumé clair : chantier, date, état global et fournitures prêtes sur total.
- Ajouter une section **À faire**, ouverte par défaut, ne contenant que les fournitures non terminées, regroupées visuellement entre **À relancer** et **À préparer / en cours**.
- Afficher « Aucun élément à traiter » lorsque tout est terminé.
- Ajouter une section **Fournitures**, ouverte par défaut, avec une ligne compacte par fourniture.
- Replier le détail éditable de chaque fourniture par défaut ; un clic sur sa ligne révèle les champs actuels, le commentaire et la suppression.
- Conserver l’ajout de fourniture dans la fiche, les notes dans une section secondaire repliable, la suppression du chantier et toutes les mutations/toasts actuels.
- Ne pas afficher de section Historique faute de donnée historique existante.

## Lecture rapide
- Ajouter une barre compacte **Aujourd’hui · Cette semaine · En retard** à partir des dates déjà chargées.
- **Aujourd’hui** : chantiers, retraits, livraisons et relances datés du jour.
- **Cette semaine** : mêmes événements entre aujourd’hui et les six jours suivants.
- **En retard** : fournitures dont la date est dépassée et dont le statut n’est pas `ok`.
- Chaque indicateur active une vue filtrée et permet d’ouvrir le chantier concerné ; aucune nouvelle notification ni nouvelle requête.

## Recherche Assistant AP
- Étendre la recherche actuelle aux chantiers, fournitures et fournisseurs avec les données déjà en mémoire.
- Présenter les correspondances regroupées sous **Chantiers**, **Fournitures** et **Fournisseurs**.
- Un résultat ouvre l’onglet ou le chantier correspondant.
- Le modèle actuel ne possède qu’un champ `client_label` commun pour le client / chantier : il sera affiché et recherché tel quel, sans inventer ni déduire un client séparé.

## Design et responsive
- Réutiliser les composants et couleurs sémantiques de Pilot Pro.
- Garder des cartes sobres, compactes, homogènes, sans gros aplats, ombres lourdes ni nouveaux indicateurs décoratifs.
- Utiliser la couleur uniquement pour distinguer **Fait**, **En cours**, **À faire** et **À relancer**.
- Éviter tout défilement horizontal sur mobile ; la vue tableau deviendra une liste dense adaptée aux petits écrans si nécessaire.

## Vérification
- Contrôler TypeScript et le dernier état de compilation.
- Vérifier sur ordinateur, tablette et mobile : 5 colonnes au format ordinateur, adaptation responsive, absence de débordement horizontal.
- Vérifier Cartes / Tableau, mémorisation du choix, filtres, recherche regroupée, Aujourd’hui, Cette semaine et En retard.
- Vérifier l’ouverture/fermeture d’une fiche, les sections hiérarchisées et le détail d’une seule fourniture.
- Avec une session réelle, vérifier les données existantes, l’ajout et la modification d’une fourniture, les notes, les suppressions, puis confirmer Calendrier, Fournisseurs et À relancer sans régression.
