# ADPP — architecture interne

ADPP est l'assistant global de Pilot Pro. Son interface reste une fenêtre flottante unique : aucune page développeur n'est exposée.

## Principes

- Les réponses distinguent données observées, calculs et recommandations.
- Les données métier sont en lecture seule par défaut.
- Une écriture ou une modification de code produit une proposition explicite.
- Toute modification sensible exige une confirmation renforcée.
- Les secrets et workflows ne sont jamais exposés à l'agent.
- L'utilisateur n'a pas besoin de connaître Git, les branches, le build ou les détails d'implémentation.

## Évolution prévue

1. outils métier PP en lecture seule ;
2. calculs déterministes et simulations ;
3. propositions d'actions réversibles ;
4. atelier de code isolé avec build et tests ;
5. aperçu puis validation avant intégration.
