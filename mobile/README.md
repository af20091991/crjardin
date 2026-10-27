# PP mobile (Android + iOS)

Coque native [Capacitor](https://capacitorjs.com) qui charge l'app PP publiée : **toute modification de PP
(PWA) apparaît aussi dans l'app mobile**, sans republier. Pas de store requis.

## Configuration
- Définir l'URL de prod : variable GitHub Actions `PP_APP_URL` (Settings → Variables) ou `PP_APP_URL=https://… npx cap sync`.
- `mobile/` est indépendant du build web (son propre `package.json`).

## Android
- CI : workflow **mobile-build** → artefact `pp-android-debug-apk` → installer l'APK sur le téléphone.
- Local : `cd mobile && npm ci && npm run android`.

## iOS
- Nécessite un Mac + Xcode : `cd mobile && npm ci && npm run ios`, puis Run sur l'iPhone branché
  (compte Apple gratuit = app valable 7 jours ; payant = TestFlight/ad hoc).

## Icônes / splash
Sources dans `mobile/resources/` ; régénérer avec `npm run assets`.
