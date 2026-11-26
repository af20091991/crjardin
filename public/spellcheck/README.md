# Détecteur d'orthographe — fichiers statiques

Utilisés par `src/components/SpellcheckAssistant.tsx` via `src/lib/spellcheck-client.ts`.
Le texte saisi **ne quitte jamais le navigateur** : tout tourne dans un Web Worker.

| Fichier | Rôle |
| --- | --- |
| `worker.js` | Worker (build minifié de `worker.src.js.txt` + [nspell](https://github.com/wooorm/nspell) 2.1.5, licence MIT) |
| `worker.src.js.txt` | Source lisible du worker (chargement du dictionnaire, vérification, classement des suggestions) |
| `fr.aff`, `fr.dic` | Dictionnaire Hunspell français — [dictionary-fr](https://github.com/wooorm/dictionaries) 3.0.0, Dicollecte/Grammalecte 7.5 |
| `LICENSE-dictionary-fr.txt` | Licence MPL 2.0 du dictionnaire (à conserver avec les fichiers) |

## Pourquoi des fichiers vendus plutôt qu'une dépendance npm ?

`bun ci` du workflow « ADPP Validation » exige un `bun.lock` figé que l'on ne peut pas
régénérer hors de l'environnement Lovable. Le worker est donc construit une fois et
versionné ; le dictionnaire est chargé à la demande au premier champ texte utilisé.

## Reconstruire `worker.js`

```bash
mkdir /tmp/dict && cd /tmp/dict && npm init -y
npm i nspell@2.1.5 esbuild
cp <repo>/public/spellcheck/worker.src.js.txt worker-src.js
npx esbuild worker-src.js --bundle --minify --format=iife --outfile=<repo>/public/spellcheck/worker.js
```

## Règles de détection (voir `src/lib/spellcheck.ts`)

Ignorés : sigles (SST, PDF), mots collés à un chiffre, adresses web, e-mails, #mots-clics,
noms propres probables (majuscule hors début de phrase) et champs techniques (e-mail, code, URL…).
Un champ peut s'exclure avec `spellcheck="false"` ou `data-no-spellcheck`.
