# Nouveau module « Site web » de Pilot Pro

## Objectif

Remplacer entièrement l'ancien module « Site web » par un centre de décision dédié à la visibilité et aux résultats du site de De la graine au jardin. Ne pas créer un tableau de bord séparé, ne pas modifier les autres modules PP, ne pas inventer de statistiques et ne jamais déclencher de modification WordPress risquée automatiquement.

## Architecture cible : 6 onglets

1. **Synthèse** — lecture rapide des indicateurs disponibles, de leur période/source et d'au plus trois priorités actionnables.
2. **SEO & mots-clés** — Search Console : clics, impressions, CTR, position, requêtes, pages, évolutions et opportunités.
3. **Audience & résultats** — GA4 : sessions, utilisateurs, pages vues, comparaisons et événements qui peuvent correspondre à des contacts. Un événement n'est pas automatiquement un prospect unique ou qualifié.
4. **SEO local** — requêtes locales Search Console et interactions Google Business Profile uniquement lorsque l'API les fournit.
5. **Concurrence & marché** — concurrents explicitement suivis, contrôles publics, PageSpeed et écarts observés. Les données estimées/publiques ne doivent jamais être présentées comme des données privées.
6. **Technique & GEO** — contrôles HTTP/HTTPS, robots.txt, sitemap, balises, données structurées, PageSpeed/Core Web Vitals, disponibilité WordPress et suivi documenté des citations IA. Les visites référées par les IA dans GA4 ne mesurent pas toutes les citations.

## Contrat des données

- Chaque indicateur doit préciser sa source et sa période ; les données sensibles à la fraîcheur affichent aussi leur date de contrôle.
- Une donnée absente, périmée ou en erreur reste « indisponible » ; elle ne devient jamais un zéro fictif.
- Distinguer mesures observées, hypothèses et recommandations.
- Les sessions, clics Google, événements GA4 et demandes commerciales sont des mesures différentes.
- Les seuils Core Web Vitals sont LCP ≤ 2,5 s, INP ≤ 200 ms et CLS ≤ 0,1 ; les mesures terrain doivent rester distinctes des mesures de laboratoire.
- Le journal de tests GEO local au navigateur est explicitement signalé comme non synchronisé ; il ne doit pas être présenté comme une mesure automatique ou exhaustive de la visibilité IA.

## Étapes de réalisation

1. Audit du dépôt, des composants existants, des intégrations et de la validation CI.
2. Définition de l'architecture et suppression des doublons de navigation.
3. Construction de la Synthèse et des six onglets en réutilisant les connexions existantes.
4. Ajout des mesures techniques et du suivi GEO avec limites explicites.
5. Validation de la sécurité, des types, du lint, des tests et du build.
6. Revue de la PR, fusion vers `main`, vérification du déploiement réel et recette de l'interface publiée.

## Contraintes de livraison

- Dépôt : `af20091991/crjardin`, branche `main` protégée ; travailler sur une branche dédiée et passer par une PR.
- Lire `AGENTS.md`, respecter les frontières serveur/client et ne pas modifier les fichiers protégés.
- Projet Supabase de production configuré : `mgkeqwwzhcodntkakqaz`. Ne pas employer un autre projet par erreur.
- Éviter les crédits Lovable pour coder lorsque GitHub/API connectées suffisent.
- Une modification écrite dans GitHub n'est pas une livraison : vérifier le SHA, la CI, la fusion et l'application publiée.
