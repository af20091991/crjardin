/**
 * DOCUMENTATION : Module Site web (Site Web Module Documentation)
 *
 * ## Aperçu

Le module Site web offre un tableau de bord centralisé pour piloter :
- **Visibilité** : données de Google Search Console (requêtes, positions, impressions, clics)
- **SEO local** : profil d'établissement Google (fiche, avis, zone géographique)
- **Contenus** : inventaire des pages du site et score SEO
- **Actions** : liste des opportunités d'amélioration priorisées

## Architecture

### Sources de données

1. **Demo Model** (`site-web-model.ts`)
   - Données d'exemple structurées et type-safe
   - Utilisées comme fallback quand les intégrations ne sont pas configurées
   - Marquées explicitement avec `source: "demo"`

2. **External Sources** (SW-05)
   - **Google Search Console** : requêtes, positions, métriques
   - **Google Analytics** : statistiques de trafic mensuelles
   - **Google Business Profile** : fiche établissement, avis, zones locales
   - Chargées via `site-web-integrations.server.ts` (stubs avec TODOs)

3. **Merger** (`site-web-merger.ts`)
   - Fusionne données externes + démo
   - Les données externes écrasent la démo si disponibles
   - Graceful fallback : si une source échoue, on garde la démo

### Flux de données

```
Client (React Component)
         |
         v
useMergedSiteWebModel() [React Query]
         |
         v
getMergedSiteWebModel() [Server Function]
         |
         v
getSiteWebExternalSources() [Server Function]
         |
         v
mergeSiteWebData() [Merger]
         |
         +---> loadSearchConsoleData() [TODO]
         +---> loadAnalyticsData() [TODO]
         +---> loadBusinessProfileData() [TODO]
         |
         v
   SiteWebModel (final merged data)
```

## Structure des fichiers

```
src/
├── lib/
│   ├── site-web-model.ts              # Types + démo data
│   ├── site-web-integrations.server.ts # Implémentations API (stubs)
│   ├── site-web-env.ts                 # Configuration env vars
│   ├── site-web-merger.ts              # Fusion démo + externe
│   ├── site-web-sources.functions.ts   # Server functions pour charger
│   ├── site-web-merged.functions.ts    # Server function pour la fusion
│   └── site-web-status.functions.ts    # Status des connexions
├── hooks/
│   ├── useSiteWebSources.ts            # Hook pour charger sources
│   └── useMergedSiteWebModel.ts        # Hook pour charger modèle fusionné
├── components/pilot/
│   ├── SiteWebDashboard.tsx            # Composant principal
│   ├── SiteWebViews.tsx                # Sous-vues (Visibility, SEO, etc)
│   └── SiteWebSourcesStatus.tsx        # Panneau de status des intégrations
└── routes/_authenticated/
    └── pilot.site-web.tsx              # Route protégée
```

## Étapes de développement

### ✅ SW-01 : Maquette (PR #19)
- Route `/pilot/site-web`
- Interface de base
- Navigation et layout

### ✅ SW-02 : Structure interne (PR #20, #22)
- Navigation latérale
- Layout du dashboard

### ✅ SW-03 : Modèle de données (PR #21, #23)
- Types TypeScript
- Données démo structurées

### ✅ SW-04 : Vues fonctionnelles (PR #24)
- Composants Visibility, SEO local, Contenus, Actions
- Dashboard avec onglets
- **Status** : En validation Prettier (fixe en cours)

### 🔄 SW-05 : Connexions externes (Branche actuelle)
- ✅ Stubs des API Google
- ✅ Server functions pour charger les données
- ✅ Merger démo + externe
- ✅ Hooks React Query
- ✅ Composant status
- ⏳ Implémentation réelle des API Google (TODO)

### 📋 SW-06 : Persistance Supabase
- Tables : `site_web_sites`, `site_web_queries`, `site_web_actions`
- Migrations SQL
- RLS policies
- Webhooks de synchronisation

### 📋 SW-07 : Synchronisations périodiques
- Cron jobs pour GSC, Analytics, Business Profile
- Limites de requêtes API
- Historique des modifications

### 📋 SW-08 : Optimisations UI/UX
- Graphiques avancés (recharts)
- Filtres et tri
- Exports et rapports

## Variables d'environnement requises (pour SW-05+)

```env
# Google Search Console
GOOGLE_SEARCH_CONSOLE_PROPERTY_URL=https://example.com

# Google Analytics
GOOGLE_ANALYTICS_PROPERTY_ID=123456789

# Google Business Profile
GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID=123456789

# Service Account (partagé)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

## Notes pour Lovable

1. **Prettier** : Le fichier `SiteWebDashboard.tsx` a eu des problèmes de formatage. Solution appliquée : extraction du tableau `metrics` en variable.

2. **Server Functions** : Les `createServerFn` de TanStack React Start gèrent automatiquement la sérialisation client/serveur.

3. **Graceful Degradation** : Si les sources externes ne sont pas connectées ou échouent, l'app affiche toujours la démo. Zéro crash.

4. **Types Importants** :
   - `SiteWebModel` : structure principale
   - `SiteWebSource` : type d'union pour tracer la source des données
   - `MetricItem` : pour le typage des métriques du dashboard

5. **Prochaine étape cruciale** : Implémenter les stubs Google (lignes marquées TODO) en SW-05, puis faire passer les tests.
