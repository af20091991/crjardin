# Dashboard — ajustements ciblés

## Résultat attendu
- Retirer entièrement le bloc « Objectifs » du Dashboard, tout en conservant le bloc SST.
- Réduire la hauteur de l’histogramme des charges variables sans changer ses données ni sa logique.
- Afficher d’abord une liste courte des communes du SEO local, avec un bouton « Voir plus » / « Voir moins » pour dérouler toutes les communes disponibles.
- Calculer « Bénéfice attendu » avec le prévisionnel total HT du mois déjà utilisé dans la page CA, moins les charges du mois.
- Classer les Top clients du mois et de l’année selon leur bénéfice réel : CA réellement comptabilisé moins charges explicitement rattachées au même client ou chantier.

## Fiabilité des calculs
- Le CA réel conserve la règle existante : seules les ventes comptabilisées par Pilot Pro entrent dans le classement.
- Une charge est déduite seulement si un rattachement explicite existe (`client`, `site/chantier` ou `intervention`) ; aucun rapprochement par ressemblance de texte ne sera inventé.
- Les investissements et la rémunération du dirigeant restent exclus des charges d’exploitation.
- Les données insuffisamment rattachées ne seront pas attribuées arbitrairement à un client.

## Modifications techniques
- Ajuster la page Dashboard et ses libellés.
- Étendre les lectures existantes des ventes/charges avec leurs identifiants de rattachement, sans deuxième requête et sans changement de base.
- Ajouter un petit calcul métier pur pour agréger CA, charges rattachées et bénéfice par client, avec tests ciblés couvrant : charge client, charge chantier, absence de charge, charge non rattachée, investissement exclu, classement mensuel et annuel.
- Ajouter une entrée courte au journal des évolutions visibles.

## Validation
- Exécuter les tests ciblés, TypeScript et la compilation.
- Vérifier le Dashboard en conditions réelles sur ordinateur et mobile : absence d’Objectifs, histogramme compact, liste SEO dépliable, bénéfice attendu correct et Top clients triés par bénéfice.
- Ne modifier ni la base, ni les permissions, ni les autres modules.
