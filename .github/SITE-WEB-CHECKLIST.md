# Checklist Site web Module

## SW-01 : Maquette ✅
- [x] Route `/pilot/site-web`
- [x] Interface vue d'ensemble
- [x] Ajout à la recherche globale (Ctrl+K)

## SW-02 : Structure interne ✅
- [x] Navigation et layout
- [x] Composants Card et Badge

## SW-03 : Modèle de données ✅
- [x] Types TypeScript pour toutes les entités
- [x] Données démo complètes et réalistes
- [x] Source tracking (demo, search_console, analytics, etc)

## SW-04 : Vues fonctionnelles 🔄
- [x] Composant SiteWebDashboard (main)
- [x] Composant SiteWebViews (subviews)
- [x] Vue Visibilité (requ��tes, positions)
- [x] Vue SEO local (fiche établissement, communes)
- [x] Vue Contenus (inventaire pages, scores SEO)
- [x] Vue Actions (opportunités et tâches)
- [ ] ⏳ Prettier validation (en cours)

## SW-05 : Connexions externes 🚀
- [x] Stubs Google Search Console
- [x] Stubs Google Analytics
- [x] Stubs Google Business Profile
- [x] Server functions pour charger les données
- [x] Merger démo + externe
- [x] Hooks React Query avec suspense
- [x] Composant status des intégrations
- [ ] ⏳ Implémentation réelle des APIs Google
- [ ] ⏳ Tests des intégrations

## SW-06 : Persistance Supabase 📋
- [ ] Migrations SQL
  - [ ] `site_web_sites`
  - [ ] `site_web_queries`
  - [ ] `site_web_local_profiles`
  - [ ] `site_web_actions`
- [ ] RLS policies
- [ ] Webhooks de synchronisation

## SW-07 : Synchronisations périodiques 📋
- [ ] Cron jobs (GSC, Analytics, Business Profile)
- [ ] Rate limiting
- [ ] Historique des changements

## SW-08 : Optimisations UI/UX 📋
- [ ] Graphiques recharts
- [ ] Filtres et tri avancés
- [ ] Exports CSV/PDF
- [ ] Rapports mensuels

## Blockers actuels

### 🔴 PR #24 (SW-04) : Prettier validation
**Status** : Dernière correction appliquée (suppression SectionItem interface)
**Solution** : Attendre résultat CI
**Impact** : SW-04 ne peut pas être mergée tant que Prettier ne passe pas

### 🟡 Lovable connexion
**Status** : Prêt pour update (SW-05 branche stable)
**Prochaine étape** : Vous devez configurer les variables d'environnement Google dans Lovable

### 🟡 APIs Google
**Status** : Stubs en place avec TODOs
**Prochaine étape** : Implémentation réelle (après validation SW-04)

## Notes de déploiement

1. **SW-04 d'abord** : Valider PR #24 (Prettier)
2. **SW-05 ensuite** : Merger `adpp/site-web-sw05-external-sources` sur dev
3. **Lovable sync** : Récupérer les changements et configurer env vars Google
4. **Test démo** : Vérifier que le fallback démo fonctionne sans erreur
5. **Impl Google** : Coder les fonctions réelles (SW-05 finale)
