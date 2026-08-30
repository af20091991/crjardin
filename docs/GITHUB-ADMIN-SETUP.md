# Configuration GitHub requise pour sécuriser Pilot Pro

Cette configuration nécessite les droits administrateur du dépôt et ne peut pas être appliquée par le connecteur de code utilisé par l'assistant.

## 1. Protéger `main`

Dans GitHub : `Settings` → `Rules` → `Rulesets` → `New branch ruleset`.

Cible : `main`.

Activer :
- Require a pull request before merging.
- Require approvals : 1 si une seconde personne est disponible ; sinon conserver une validation manuelle du propriétaire.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Block force pushes.
- Restrict deletions.
- Require conversation resolution before merging.

Le contrôle obligatoire à sélectionner est le job `validate` du workflow `ADPP Validation`.

Ne pas activer l'obligation de commits signés tant que la méthode de signature utilisée par le compte n'a pas été vérifiée : cela pourrait bloquer les commits produits par Lovable ou d'autres intégrations.

## 2. Ne pas autoriser de contournement inutile

Le ruleset doit rester `Active` et ne prévoir aucun bypass pour les utilisateurs/intégrations qui n'en ont pas besoin.

## 3. Après création

Vérifier que `main` affiche bien les protections et qu'une PR dont la CI échoue ne peut plus être fusionnée.

## 4. Sécurité `.env`

Le dépôt contient actuellement un `.env` suivi par Git. Ne pas le supprimer brutalement. Le chantier dédié doit d'abord identifier les variables publiques et secrètes, migrer les secrets vers l'environnement approprié, puis retirer le fichier du suivi et décider d'une rotation des clés si nécessaire.
