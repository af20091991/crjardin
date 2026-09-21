# Plan — Module « Calendrier SST »

## Audit effectué

### Données et écrans déjà existants à réutiliser
- **Utilisateurs / rôles** : rôles existants `admin`, `prestataire`, `observateur`; les hooks actuels distinguent admin et prestataire côté interface, mais les droits critiques doivent être renforcés côté serveur/base.
- **SST** : table existante `subcontractors` avec nom, société, email, téléphone, spécialités, tarif, actif/inactif.
- **Missions SST** : table existante `subcontractor_missions` avec `subcontractor_id`, `client_id`, `site_id`, `worksite_sheet_id`, `intervention_id`, date, statut, consignes, objectif, compte-rendu, anomalies, recommandations, heures, prix et marge.
- **Clients / sites / fiches chantier** : tables existantes `clients`, `sites`, `contacts`, `worksite_sheets`; elles doivent rester les pivots, sans doublon.
- **Interventions / CR** : table existante `interventions`, photos, tâches et historique de comptes-rendus déjà reliés aux clients et fiches chantier.
- **Notifications** : table existante `notifications`, cloche temps réel et lecture/non-lu déjà en place.
- **Planning existant** : page `Planning` et table `planning_notes`, utile comme référence d’interface, mais insuffisante pour les disponibilités SST.
- **UI réutilisable** : `AppShell`, composants de cartes, onglets, calendrier, tableaux, badges, dialogues, boutons, formulaires et notifications.

### Ce qui manque
- Un lien fiable entre un compte utilisateur `prestataire` et une fiche `subcontractors`.
- Des disponibilités SST structurées : date, heure début, heure fin, statut, commentaire.
- Des demandes de disponibilité envoyées par le dirigeant aux SST.
- Une affectation multi-SST sur une intervention ou mission, avec réponse par SST.
- Des créneaux horaires pour détecter les conflits.
- Un historique/audit dédié aux actions de planning SST.
- Des paramètres configurables du module.
- Des notifications reliées précisément aux objets du calendrier SST.

### Risques à maîtriser
- Ne pas utiliser uniquement le masquage des boutons : les règles d’accès doivent être appliquées côté base et côté fonctions serveur.
- Ne pas créer une deuxième base de clients, chantiers, SST ou comptes-rendus.
- Ne pas confondre disponibilité et affectation : une disponibilité n’engage jamais automatiquement un SST.
- Ne pas surcharger `subcontractor_missions` avec des responsabilités incompatibles; elle reste une mission SST réelle, le calendrier ajoute une couche de coordination.
- Préserver les modules financiers, CA, heures et rentabilité existants.

## Architecture proposée

### Tables minimales à ajouter
1. **`sst_user_links`**
   - Lie une fiche SST existante à un utilisateur connecté.
   - Permet à un SST de voir et modifier uniquement ses propres données.

2. **`sst_availabilities`**
   - Disponibilités, indisponibilités, disponibilités partielles et statuts « À confirmer ».
   - Champs : SST, date, heure début, heure fin, statut, commentaire, auteur.

3. **`sst_availability_requests`**
   - Demandes de disponibilité envoyées par le dirigeant.
   - Champs : période, type d’intervention éventuel, commentaire, date limite, statut.

4. **`sst_availability_request_targets`**
   - Liste des SST concernés par chaque demande et leur réponse.
   - Champs : demande, SST, statut, commentaire, date de réponse.

5. **`sst_intervention_assignments`**
   - Affectations multi-SST sur une intervention existante ou une mission SST existante.
   - Champs : intervention/mission, SST, statut de réponse, commentaire, dates de notification/réponse.

6. **`sst_calendar_settings`**
   - Paramètres globaux : horizon obligatoire, délai de rappel, délai de confirmation, rappels avant intervention, options d’affichage.

7. **`sst_calendar_audit_log`**
   - Historique des changements importants.
   - Champs : utilisateur, objet, action, ancienne valeur, nouvelle valeur.

8. **`sst_calendar_conflicts`**
   - Conflits détectés et conservés pour suivi.
   - Champs : type, sévérité, objet, SST, date, message, statut de résolution.

### Données existantes non dupliquées
- Client : `clients`.
- Site/chantier : `sites` et `worksite_sheets`.
- Intervention : `interventions`.
- Mission sous-traitée : `subcontractor_missions`.
- SST : `subcontractors`.
- Compte-rendu : champs CR existants sur `interventions` et `subcontractor_missions`, plus historique existant lorsque pertinent.
- Notifications : table `notifications`, enrichie par les nouvelles fonctions métier sans créer de système parallèle.

### Permissions prévues
- **Admin** : lecture et gestion complète du calendrier SST, des demandes, affectations, paramètres, conflits et historique.
- **SST lié à une fiche** : lecture du calendrier partagé selon les règles prévues, gestion de ses disponibilités, réponse à ses demandes et affectations, ajout des commentaires/CR autorisés.
- **Observateur** : lecture limitée selon les règles existantes.
- Les règles seront placées en RLS et complétées par des fonctions serveur authentifiées pour les actions complexes.

## UX proposée

### Route et navigation
- Nouvelle entrée : **Activité → Calendrier**.
- Nouvelle route protégée : `/pilot/calendrier`.
- Accessible aux admins et aux utilisateurs SST.

### Organisation de la page
1. **Synthèse opérationnelle**
   - Disponibilités à jour.
   - Réponses en attente.
   - Interventions à confirmer.
   - Conflits.
   - Comptes-rendus en attente.
   - Chaque indicateur filtre directement la liste concernée.

2. **Vues du calendrier**
   - Mois.
   - Semaine.
   - Agenda/liste.
   - Vue personnelle.
   - Vue partagée.

3. **Qui est disponible ?**
   - Sélection d’une période.
   - Matrice SST × jours.
   - Cellule cliquable pour voir le détail.

4. **Actions à traiter**
   - Disponibilités insuffisantes.
   - Demandes expirées/non répondues.
   - Interventions non confirmées.
   - Conflits.
   - CR manquants.

5. **Détail intervention / affectation**
   - Client, site, date, horaires, consignes.
   - SST requis, affectés, confirmés, restant à pourvoir.
   - Réponses SST : confirmer, refuser, à vérifier.

6. **Paramètres**
   - Horizon de disponibilité : 3 mois par défaut.
   - Rappel : 1 mois avant par défaut.
   - Délais et options d’affichage.

## Implémentation par étapes

### Étape 1 — Socle sécurisé
- Ajouter les tables minimales avec index, RLS, droits d’accès et fonctions d’audit.
- Ajouter les fonctions serveur authentifiées pour lire/écrire les données du calendrier.
- Ajouter les fonctions de calcul : horizon des disponibilités, actions à traiter, conflits simples.

### Étape 2 — Première interface opérationnelle
- Créer `/pilot/calendrier`.
- Ajouter l’entrée **Activité → Calendrier**.
- Afficher la synthèse, la vue agenda, la matrice « Qui est disponible ? » et les actions à traiter.
- Permettre à un SST de saisir/modifier/supprimer ses disponibilités.
- Permettre à l’admin de demander des disponibilités.

### Étape 3 — Propositions et confirmations
- Ajouter les affectations multi-SST sur intervention/mission.
- Permettre à l’admin de proposer un chantier.
- Permettre au SST de confirmer, refuser ou demander vérification.
- Créer les notifications correspondantes.

### Étape 4 — Conflits, CR et historique
- Détecter indisponibilité, chevauchement, hors disponibilité, sous-effectif et réponse tardive.
- Lier le compte-rendu à l’intervention/mission sans fusionner les commentaires de planning.
- Afficher l’historique d’audit pour le dirigeant.

### Étape 5 — Validation
- Vérifier les scénarios métier fournis : disponibilités, rappels, demandes, propositions, confirmations/refus, modification, conflits, multi-SST, CR, permissions, historique.
- Vérifier typage, tests pertinents, build et absence de régression sur les modules existants.

## Tranche immédiate après validation du plan
- Créer le socle base + sécurité.
- Créer la route `/pilot/calendrier` avec l’interface opérationnelle de base.
- Brancher les disponibilités, demandes, synthèse, matrice et actions à traiter sur les vraies données.
- Ne pas toucher aux calculs financiers, CA, heures, rentabilité, `roadmap.md` ni `src/lib/changelog.ts`.
