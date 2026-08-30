# Workflow de développement PP

## Objectif

Ce document définit le circuit de référence pour modifier Pilot Pro sans multiplier les allers-retours avec Lovable et sans empiler des modifications sur un état instable.

## Rôles

- **GPT / assistant de code** : analyse le code réel, propose ou réalise les modifications, limite le périmètre, contrôle les diff et suit les validations.
- **GitHub** : source de vérité du code, historique, branches, commits, CI et point de restauration.
- **Lovable** : environnement de prévisualisation et d'itération UI/produit ; il ne constitue pas la validation finale du code.
- **Utilisateur** : décrit le besoin métier, vérifie le comportement visuel/fonctionnel et valide la mise en production.

## Règle fondamentale

Une modification significative ne doit pas être empilée sur une branche dont la validation est en échec.

## Circuit standard

1. Partir de `main` ou d'un commit explicitement identifié comme stable.
2. Créer une branche dédiée au chantier : `fix/...`, `feature/...` ou `refactor/...`.
3. Lire les fichiers concernés avant toute écriture.
4. Modifier uniquement le périmètre nécessaire.
5. Contrôler le diff.
6. Exécuter la validation (`bun run validate` lorsque l'environnement le permet ; la CI GitHub reste la référence).
7. Vérifier le comportement dans Lovable/preview si le chantier touche l'interface.
8. Corriger toute erreur de validation avant de poursuivre.
9. Ouvrir une PR vers `main` pour les chantiers significatifs.
10. Fusionner uniquement une modification dont la validation GitHub est verte.

## Convention de branche

- `fix/` : correction ciblée sans changement fonctionnel volontaire.
- `feature/` : nouvelle fonctionnalité.
- `refactor/` : restructuration interne sans changement métier recherché.
- `infra/` : outillage, CI, documentation ou environnement de développement.

Une branche = un chantier cohérent. Éviter les branches longues qui mélangent plusieurs sujets.

## Contrôles obligatoires

La CI `ADPP Validation` contrôle actuellement :

1. fichiers protégés ;
2. formatage ;
3. TypeScript ;
4. lint ;
5. tests unitaires ;
6. build de production.

Les règles métier et fichiers protégés sont décrits dans `AGENTS.md`.

## Fichiers protégés

Les fichiers générés, d'authentification, de configuration Supabase et les secrets ne doivent pas être modifiés dans un chantier normal. La CI doit bloquer toute modification accidentelle de ces fichiers.

## Interaction avec Lovable

Lovable peut produire des commits sur `main` et rester utile pour l'itération produit. Lorsqu'une modification est faite directement dans GitHub, vérifier ensuite que Lovable a bien resynchronisé le projet avant de demander une nouvelle modification via Lovable.

Ne jamais demander à Lovable de « corriger tout le projet » lorsqu'un fichier ou un sous-ensemble précis suffit. Référencer le périmètre exact et une responsabilité à la fois.

## Pour les interventions de GPT

Le demandeur n'a normalement pas à copier du code entre GitHub et Lovable. Il décrit le résultat attendu. L'assistant doit lire le dépôt, effectuer les modifications autorisées, vérifier le diff et signaler uniquement les actions qui nécessitent réellement une intervention humaine.

## État stable

`main` représente la branche de référence. Une branche de travail peut être temporairement cassée pendant une intervention, mais elle doit être réparée et validée avant d'être fusionnée ou utilisée comme base d'un autre chantier.
