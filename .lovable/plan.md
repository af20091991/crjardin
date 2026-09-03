# Rétablissement de la fonction Edge « site-web-api »

## Diagnostic (confirmé en lecture seule)

- La fonction `site-web-api` **n'est pas déployée** : appel direct → 404 « function not found ». Le code existe dans `supabase/functions/site-web-api/index.ts` mais n'a jamais été publié sur l'instance actuelle.
- Les 4 secrets requis (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SITE_WEB_GOOGLE_REDIRECT_URI`, `SITE_WEB_APP_URL`) **n'existent pas** dans les secrets du projet.
- Le front `src/lib/site-web-api.ts` appelle une URL Supabase **figée vers l'ancienne instance** (`wdygsbmivqxvgkgpbrqc`), alors que le projet est désormais sur l'instance Lovable Cloud `mgkeqwwzhcodntkakqaz` — même déployée, la fonction serait appelée au mauvais endroit.
- Aucune erreur de build/déploiement récente ; aucun log de la fonction.

## Plan de correction

1. **Déployer la fonction Edge** `site-web-api` telle quelle sur l'instance actuelle (outil de déploiement Edge).
2. **Corriger `src/lib/site-web-api.ts`** : remplacer l'URL figée par l'URL de l'instance courante (via `import.meta.env.VITE_SUPABASE_URL`), sans toucher au reste de la logique.
3. **Vérifier** : appel de test `status` → attendre un JSON (401 `unauthorized` sans session = OK, la fonction répond ; 404 = échec).
4. **Tests/build** : typecheck + `bun test` + `bun run build`.

## Action manuelle restante (hors code, inévitable)

Après déploiement, ajouter dans **Réglages du projet → Secrets** :
- `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` (issus de Google Cloud Console, écran de consentement OAuth configuré)
- `SITE_WEB_GOOGLE_REDIRECT_URI` = `https://<instance>/functions/v1/site-web-api` (valeur exacte fournie après déploiement — à déclarer aussi comme URI de redirection autorisée dans Google Cloud)
- `SITE_WEB_APP_URL` = `https://crjardin.lovable.app/pilot/site-web`

Sans ces 4 secrets, l'onglet affichera « Google OAuth non configuré » — c'est le comportement attendu jusqu'à la configuration.
