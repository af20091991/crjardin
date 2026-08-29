# ADPP — Architecture cible

## Principe
ADPP est un assistant de direction intégré à Pilot Pro. L'interface utilisateur reste unique et non technique. Les opérations de développement sont réalisées en arrière-plan et soumises à validation avant toute modification métier ou applicative.

## Niveaux
1. Direction : raisonnement, synthèse, stratégie.
2. Analyste : données PP en lecture seule, calculs déterministes, simulations.
3. Atelier : proposition de modifications du code, contrôle, aperçu, validation.

## Sécurité
- Ne jamais écrire silencieusement dans les données métier.
- Ne jamais appliquer automatiquement une modification de code sensible.
- Travailler sur une branche isolée.
- Refuser les fichiers secrets et les workflows protégés par défaut.
- Exécuter build/tests avant de proposer l'application.
- Présenter à l'utilisateur uniquement le résultat utile : modification, impact, contrôles, aperçu, appliquer/annuler.

## Cycle Atelier
Demande → analyse du contexte → plan → patch → validation technique → build/tests → contrôle anti-régression → aperçu → validation utilisateur → intégration.

## UX
Aucune page développeur n'est requise. Les détails Git, branches, commits, npm, TypeScript et CI restent masqués sauf demande explicite.

## Règle de fiabilité
Toute réponse portant sur une donnée Pilot Pro doit provenir des outils de données de PP ou d'un calcul explicitement traçable. ADPP ne doit jamais inventer une valeur absente.
