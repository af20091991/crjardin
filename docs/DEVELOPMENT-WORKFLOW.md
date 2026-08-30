# Workflow de développement PP

## Objectif

Ce document définit le circuit de référence pour modifier Pilot Pro avec un minimum d'allers-retours entre GPT, GitHub et Lovable, tout en gardant un historique réversible et une validation technique fiable.

## Rôles

- **GPT / assistant de code** : analyse le code réel, limite le périmètre, effectue les modifications autorisées, contrôle le diff et suit les validations.
- **GitHub** : source de vérité du code, historique, branches, commits, CI et point de restauration.
- **Lovable** : environnement de prévisualisation et d'itération produit ; il ne remplace pas la validation CI.
- **Utilisateur** : décrit le besoin métier, vérifie le comportement visuel/fonctionnel et intervient seulement lorsque ses droits ou une décision métier sont nécessaires.

## Règle fondamentale

Une modification significative ne doit pas être empilée sur une branche dont la validation est en échec.

## Circuit standard

1. Partir de `main` ou d'un commit explicitement identifié comme stable.
2. Créer une branche dédiée : `fix/...`, `feature/...`, `refactor/...` ou `infra/...`.
3. Lire les fichiers concernés et `AGENTS.md` avant toute écriture.
4. Modifier uniquement le périmètre nécessaire.
5. Contrôler le diff.
6. Exécuter la validation ; la CI GitHub reste la référence.
7. Vérifier Lovable/preview si le chantier touche l'interface.
8. Corriger toute erreur de validation avant de poursuivre.
9. Ouvrir une PR vers `main` pour les chantiers significatifs.
10. Fusionner uniquement une modification validée.

## CI et notifications

La CI `ADPP Validation` doit rester reproductible : version Node/Bun explicite, lockfile respecté, fichiers protégés, formatage, TypeScript, lint, tests et build.

Les branches de travail ne doivent pas déclencher inutilement la validation complète à chaque push. La validation complète est concentrée sur les PR vers `main` et sur `main`, avec annulation des exécutions obsolètes.

Les notifications GitHub Actions sont idéalement réglées sur les échecs uniquement ; les succès restent consultables dans GitHub.

## Sécurité

- Ne jamais publier de secrets dans une issue, PR, log ou documentation.
- Ne pas supprimer ou modifier un fichier d'environnement sensible sans avoir identifié ses usages.
- Toute rotation de clé doit être planifiée et vérifiée.
- Les fichiers protégés par `AGENTS.md` ne sont pas modifiés sans justification explicite.
- `main` doit être protégée par des règles GitHub lorsque les droits d'administration le permettent.

## Traçabilité

Chaque amélioration de l'environnement doit laisser une trace dans Git : commit, documentation, configuration ou issue selon sa nature.

Le but n'est pas d'ajouter des outils pour eux-mêmes, mais de rendre les modifications plus faciles, plus rapides, plus sûres et réversibles, avec le moins d'intervention manuelle possible.
