# ADPP — workflow durable de modification du code Pilot Pro

## Objectif

Ce document est la référence réutilisable pour toute intervention directe sur le code source de Pilot Pro (PP). Il évite de repartir de zéro et décrit la chaîne de travail qui a été stabilisée.

## Principe

**Analyser → modifier au minimum → valider le SHA réel → CI → corriger la cause → revalider.**

Aucune modification métier ne doit être considérée comme terminée uniquement parce qu'elle a été écrite dans GitHub.

## Chaîne de travail

1. Travailler sur une branche dédiée `adpp/work/<sujet>` ou une branche de travail existante explicitement identifiée.
2. Lire le fichier et son SHA avant toute écriture.
3. Modifier uniquement le fichier et les lignes nécessaires.
4. Ne jamais reconstruire un gros fichier à partir d'un extrait ou remplacer un fichier complet pour une petite correction.
5. Créer/mettre à jour la PR vers `main`.
6. Vérifier que le `head_sha` de la PR correspond exactement au commit que l'on vient de créer.
7. Lancer la validation ADPP sur le HEAD réel de la PR, pas sur un merge-ref supposé identique.
8. Ne pas lancer une seconde modification concurrente pendant qu'un contrôle est en cours si elle rendrait son résultat ambigu.
9. Corriger la cause de chaque échec, puis relancer la chaîne.
10. Considérer la modification comme validée seulement lorsque TypeScript, ESLint, tests et build production sont verts.

## Garde-fous CI obligatoires

La validation doit contrôler, dans cet ordre :

- installation depuis le graphe Bun verrouillé ;
- fichiers protégés ;
- formatage des fichiers modifiés ;
- TypeScript ;
- ESLint des fichiers modifiés ;
- tests unitaires ;
- build production ;
- résumé explicite de validation.

Le workflow doit vérifier le **SHA réellement demandé** et échouer si le checkout ne correspond pas au SHA attendu.

## Règles anti-retour en arrière

### 1. Désynchronisation GitHub/PR
Toujours comparer :

- branche de travail ;
- `pull_request.head.sha` ;
- commit créé ;
- SHA effectivement checkouté par CI.

Si ces valeurs divergent, **ne pas corriger le code** : corriger d'abord la chaîne Git/CI.

### 2. Écriture destructive
Une petite correction ne doit jamais provoquer une réécriture massive de `pilot.ca.tsx` ou d'un autre gros fichier.

Avant une écriture : récupérer le SHA courant. Après l'écriture : conserver le commit SHA et contrôler immédiatement le contenu.

### 3. Tests
Un test qui échoue doit être classé avant correction :

- régression réelle du produit ;
- test obsolète par rapport au comportement voulu ;
- problème d'environnement/outillage.

Ne pas modifier le produit pour faire passer un test qui décrit un ancien comportement si le nouveau comportement est volontaire.

### 4. Build
Un échec de build doit être localisé à son étape exacte. Ne pas revenir à une révision antérieure simplement parce que le build échoue : identifier le fichier, la configuration et la sortie attendue.

## État de référence atteint pendant la stabilisation

La chaîne a atteint un run ADPP Validation entièrement vert :

- installation : OK
- fichiers protégés : OK
- formatage : OK
- TypeScript : OK
- ESLint : OK
- tests : OK
- build production : OK

Cette validation constitue la référence technique du chantier de fiabilisation, mais **chaque nouvelle modification doit être revalidée**.

## Pour les futures interventions PP

Le contexte à reprendre est :

> « Utiliser le workflow ADPP documenté dans `docs/ADPP-CODE-WORKFLOW.md`. Vérifier le SHA avant écriture, modifier au minimum, contrôler le SHA de la PR, puis attendre la validation complète TypeScript + ESLint + tests + build. Ne jamais réécrire un gros fichier pour une correction locale. »

## Critère de fin

Le chantier n'est réellement terminé que si ADPP peut :

**lire → écrire → valider → corriger → revalider**, de façon répétable, sans perte de code ni validation d'une mauvaise révision.
