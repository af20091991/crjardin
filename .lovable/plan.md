# Nouvel écran de démarrage mobile PilotPro (analyse, aucune modification faite)

## Ce qui existe aujourd'hui

- **Trois écrans de démarrage empilés sur mobile** :
  1. l'écran natif de la coque (`mobile/capacitor.config.ts`, SplashScreen : fond #F9F7F2, jusqu'à 5 s, masqué par un script de `__root.tsx` au `load` ou à 1,5 s) ;
  2. `SplashOverlay` dans `src/routes/__root.tsx` : logo `/pp-logo.png` qui grandit, cercle SVG, graines, « PilotPro » + barre, affiché sur web ET mobile, retiré par `hideSplash()` (minimum 2,4 s ; filet de sécurité 9 s) ;
  3. `SproutSplash.tsx` : animation plume Jardin Signature (`/js-logo.png`, `/js-feather.png`), uniquement sur `/jardin-signature` et `/partage` ; le splash PP y est déjà caché via la classe `js-client`.
- Bug mineur constaté : dans `hideSplash()`, `t0` est pris à l'appel, donc l'attente vaut toujours 2,4 s pleines au lieu d'un minimum.
- **Assets** : `/pp-logo.png` et `src/assets/logo.png` sont identiques (886×886, PNG). Le texte « PilotPro » et la mention « au rythme de la nature » sont **incrustés dans l'image**, ainsi que le cercle brun. Il n'existe **aucune version** du logo avec le libellé « De la graine au jardin », ni de version vectorielle séparée (feuilles / pétiole / cercle / texte). `/js-*` concernent Jardin Signature et ne servent pas ici.

## Blocage principal

Un PNG ne peut pas être « dessiné » trait par trait, ni voir son texte remplacé. Il faut le logo en calques :
- pétiole (crosse brune à gauche), corps de la feuille (4 couleurs), cercle extérieur, mention « au rythme de la nature », sans aucun texte de titre.

Option A (recommandée) : vous fournissez le fichier officiel (SVG, AI, PDF vectoriel).
Option B : je reconstitue les calques à partir de `pp-logo.png` (texte « PilotPro » effacé, cercle retracé en SVG, feuilles révélées par masque), les deux libellés étant écrits en Fraunces vert primary. Rendu proche mais pas strictement « officiel ».

## Animation proposée (≈ 5,5 s)

```text
0,0–1,2 s  pétiole qui pousse depuis le bas (masque vertical)
1,2–2,4 s  corps de la feuille révélé du bas vers la pointe
2,0–3,6 s  cercle tracé dans le sens horaire depuis le bas gauche
~3,3 s     « De la graine au jardin » fond-enchaîné vers « Pilot Pro »
3,7–5,3 s  2 cycles « lub-dub » = 4 pulsations (échelle 1 → 1,03)
5,3–5,8 s  fondu vers l'application
```
Fond uni #F9F7F2 (suppression du dégradé, des graines et de la barre). Couleurs reprises des tokens (vert primary, orange accent, brun du logo).

## Où et quand le jouer

- **Uniquement dans l'application mobile** (détection Capacitor via `isNativeApp()` / `window.Capacitor`, déjà utilisé), et une seule fois par lancement à froid (marqueur `sessionStorage`). Pas lors d'un retour d'arrière-plan ni d'une navigation.
- **Web desktop et navigateur mobile** : on garde un écran sobre et court (logo statique + fondu, retiré dès que l'appli est prête), comme proposé ; ou suppression pure, à votre choix.
- **/jardin-signature et /partage** : inchangés, toujours exclus (classe `js-client`) — ils gardent leur plume.
- **prefers-reduced-motion** : logo final immobile 0,6 s, pas de pulsation, pas de son.
- **Chargement / connexion non bloqués** : l'appli démarre en dessous pendant l'animation ; l'écran est une couche visuelle qui ne retarde ni l'authentification ni les requêtes. Toucher l'écran le passe immédiatement. Filet de sécurité conservé (retrait forcé à 9 s).

## Éviter le double splash

- Écran natif Capacitor : même fond crème, sans logo (image native unie) ou avec le logo final strictement à la même position, puis masqué **dès le premier affichage** de la page (le script actuel le fait déjà ; passer `launchShowDuration` de 5000 à une valeur courte, nécessite une nouvelle version de l'appli mobile via la coque).
- Ainsi : fond crème natif → animation web enchaînée sans saut → application.

## Son : stratégie fiable

- Constat : au lancement, **aucun geste utilisateur** n'a eu lieu ; iOS (WKWebView) et Android bloquent ou peuvent bloquer l'audio automatique, et le mode silencieux iOS n'est pas détectable de façon fiable depuis la page. Un son « garanti » n'est donc pas possible sans forcer.
- Proposition :
  1. **Vibrations (haptique) par défaut** pour les 4 battements via le plugin Haptics déjà installé dans la coque : fonctionne au lancement, respecte nativement le mode silencieux / réglages de vibration.
  2. **Son optionnel, désactivé par défaut**, activable dans Personnalisation (« Son au démarrage »). Une fois activé (geste utilisateur = autorisation), un court fichier audio (4 battements, < 30 Ko) est tenté au lancement ; s'il est bloqué, échec silencieux, l'animation continue. Sur iOS, un son web joué en catégorie « ambient » est coupé par le bouton silencieux.
  3. Aucun son sur web, en mode réduit, ni sur les parcours clients.
- Le fichier son devra être fourni ou créé (pas d'invention de marque sonore sans votre accord).

## Questions à trancher

1. Option A (fichier vectoriel officiel) ou B (reconstitution) ?
2. Web : écran sobre court ou aucun écran ?
3. Son : haptique seule, ou haptique + son optionnel ?

## Détails techniques

- Nouveau composant `src/components/PilotLaunchSplash.tsx` (SVG : `stroke-dasharray` pour le cercle depuis l'angle bas gauche ~225°, `clipPath`/masques animés pour pétiole et feuille, deux `<text>` croisés), monté par `__root.tsx` à la place de `SplashOverlay` quand natif ; `SplashOverlay` simplifié pour le web.
- Le rendu serveur ne connaît pas Capacitor : un script en tête pose `html.pp-native` avant la peinture pour éviter le flash ; même exclusion regex `/jardin-signature|partage` qu'aujourd'hui.
- Correction de `hideSplash()` (minimum réel mesuré depuis le début de l'animation).
- Haptique : `Capacitor.Plugins.Haptics.impact({style:'LIGHT'|'MEDIUM'})` aux temps 3,7 / 3,95 / 4,5 / 4,75 s.
- Coque : changement de `launchShowDuration` et image native → nouvelle build APK/iOS (hors Lovable). Sans nouvelle build, l'animation fonctionne quand même car la coque charge l'appli publiée.
- Entrée changelog ; aucune donnée, droit ni Supabase touché.
