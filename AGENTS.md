# AGENTS.md — Guide pour tout assistant de code (ChatGPT, Lovable, autre)

Ce fichier est la référence unique pour modifier l'application **PP (Pilot Pro)** de
« De la graine au jardin ». Tout assistant (ChatGPT en premier lieu) est autorisé à lire,
modifier et créer du code dans ce dépôt en respectant les règles ci-dessous.

## 1. Stack

- TanStack Start v1 (React 19) + Vite 7, TypeScript strict.
- Router de fichiers : `src/routes/**` → `src/routeTree.gen.ts` (**généré, ne jamais éditer**).
- Tailwind CSS v4 via `src/styles.css` (`@theme`, tokens sémantiques OKLCH). Pas de `tailwind.config.js`.
- UI : shadcn/ui (`src/components/ui/*`) + Radix + lucide-react + recharts + sonner.
- Backend : Supabase (Lovable Cloud). Client : `import { supabase } from "@/integrations/supabase/client"`.
- IA : Lovable AI Gateway (`LOVABLE_API_KEY`, serveur uniquement).

Commandes :

```bash
bun install
bun run dev        # http://localhost:8080
bun run build      # build prod
bun run lint
bun test           # tests unitaires (src/lib/__tests__)
```

## 2. Frontières client / serveur

- Logique serveur interne → `createServerFn` depuis `@tanstack/react-start`, dans un
  fichier `*.functions.ts` (importable côté client).
- Helpers serveur uniquement → `*.server.ts` (jamais importés par un composant ;
  utiliser `await import(...)` dans le handler si besoin).
- Endpoints HTTP externes (webhooks, cron, API publique) → `src/routes/api/public/*`
  avec vérification du caller dans le handler.
- `process.env.*` se lit **dans** le handler. Côté navigateur : `import.meta.env.VITE_*`.
- Routes protégées : sous `src/routes/_authenticated/`. Une serverFn avec
  `requireSupabaseAuth` ne doit jamais être appelée depuis un `loader` de route publique.
- Fichiers auto-générés à ne jamais modifier : `src/routeTree.gen.ts`,
  `src/integrations/supabase/{client.ts,client.server.ts,types.ts,auth-middleware.ts,auth-attacher.ts,previewAuthStorage.ts}`,
  `.env`, `supabase/config.toml`.

## 3. Base de données

- Toute évolution de schéma passe par une **migration SQL** (dossier `supabase/`), jamais
  par un script ad hoc.
- Toute nouvelle table `public` : `CREATE TABLE` → `GRANT` (authenticated / service_role,
  `anon` seulement si une policy l'autorise) → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`.
- Les rôles sont dans `user_roles` + fonction `has_role` (jamais sur `profiles`/`clients`).
  Côté front : `useRole()` / `useIsAdmin()`.
- Après migration, régénérer/valider les types utilisés depuis `src/integrations/supabase/types.ts`.

## 4. Règles métier PP — invariants à ne jamais casser

1. **Heures : source unique = colonne Vente → Temps** (`pilot_ca_entries.hours`).
   `interventions.hours_spent` et l'historique = historique seul, jamais un substitut.
   Point d'entrée : `src/lib/pilot-hours-ledger.ts`, `src/lib/pilot-sale-time.ts`.
2. **Avant 2026 le Temps n'existe pas** : ce n'est jamais une anomalie.
   `TIME_TRACKING_START_YEAR` dans `src/lib/pilot-time-scope.ts` — toute file d'anomalies
   doit exclure l'historique.
3. **Taux horaire** = CA TOTAL du périmètre ÷ temps interne (Vente → Temps).
   Une mission SST à 0 h compte son CA et ajoute 0 h. Voir `hourlyRateFromSales`.
4. **Interventions** dans les vues économiques = nombre de lignes de vente
   (`src/lib/pilot-intervention-count.ts`), jamais les CR ni les missions SST.
5. **Comptabilisation** : le temps compte dès 🟠 Facturé, le CA seulement à 🟢 Réglé
   (`src/lib/pilot-sale-accounting.ts`).
6. **Bénéfice = CA − Charges** ; charges lues uniquement depuis `pilot_ca_entries`
   (`kind = "charge"`), la table legacy `pilot_charges` n'existe plus.
7. **Rapprochement nature** : Excel d'abord → désignation exacte → classement PP.
   Les conflits sont signalés, jamais écrasés (`src/lib/pilot-excel-nature.ts`).
8. **Client = référence unique** ; hiérarchie Client → Propriété/Site → Contrat → Intervention.
9. Périmètre temporel : toujours passer par l'exercice global (`usePilotYear`,
   `src/lib/pilot-realized.ts`) — pas d'état local de période.
10. Pas de donnée fictive, pas de valeur par défaut inventée : si la donnée manque,
    afficher un état « données insuffisantes ».

## 5. UI / design

- Marque produit : **« De la graine au jardin »** (SEO, emails). Libellé in-app :
  **« CR Pro » + version** (`src/lib/app-meta.ts`, piloté par `changelog[0]`).
  Jamais « Jardin Pro » ni « CR Jardin ».
- Palette : vert profond `#4F8E33` (primary), orange `#EE8627` (accent), fond crème.
  Polices Fraunces + Inter. **Uniquement des tokens sémantiques** (`bg-background`,
  `text-primary`…) — jamais `text-white`, `bg-black`, `bg-[#...]`.
- Personnalisation (`src/lib/appearance.tsx`, `src/lib/pilot-card-display.ts`) = présentation
  seule via attributs `data-*` sur `<html>` ; elle ne change aucune règle métier.
- Carte standard des écrans Pilot : `src/components/pilot/PilotCard.tsx`.
- Langue de l'interface : français.

## 6. Conventions de code

- Alias `@/` → `src/`. Composants en PascalCase, modules `src/lib/*` en kebab-case.
- Un module `src/lib/x.ts` = une responsabilité métier pure et testable ; les composants
  ne contiennent pas de calcul métier.
- Chaque route de contenu déclare son `head()` (title, description, og:*).
- Données : TanStack Query (`useQuery`/`useSuspenseQuery`), pas de `fetch` dans `useEffect`.
- Ajouter/mettre à jour un test dans `src/lib/__tests__` pour toute règle de calcul.
- Une entrée dans `src/lib/changelog.ts` pour toute évolution fonctionnelle visible.

## 7. Checklist avant de livrer une modification

- [ ] `bun run build` passe (ou `bun run lint` + `bun test` au minimum).
- [ ] Aucun invariant de la section 4 contourné.
- [ ] Aucun fichier auto-généré modifié.
- [ ] Aucune couleur/police en dur.
- [ ] Migration SQL fournie si le schéma change (avec GRANT + RLS).
- [ ] Secrets jamais exposés côté client.

## 8. Règles de modification sûre — assistants et Lovable

- **Lire avant d'écrire** : toujours récupérer le fichier actuel et son contexte immédiat avant une modification.
- **Modification minimale** : modifier uniquement ce qui est nécessaire ; ne pas réécrire un gros composant pour un changement local.
- **Une responsabilité à la fois** : éviter de mélanger correction de syntaxe, refactor, design et logique métier dans la même modification.
- **Validation immédiate** : après une modification significative, lancer au minimum `bun run typecheck` et, si possible, `bun run validate`.
- **Arrêt sur erreur** : si une validation échoue, corriger ou restaurer avant de poursuivre d'autres modifications dépendantes.
- **Pas de chaîne de modifications sur un état cassé** : une branche avec un build cassé doit être réparée avant toute nouvelle évolution.
- **Ne pas modifier les fichiers protégés** listés en section 2. Une vérification CI automatique bloque ces changements.
- **Git est le point de restauration** : avant un chantier à risque, travailler depuis un commit connu comme fonctionnel et conserver des commits courts et cohérents.
- **Ne jamais considérer Lovable comme la validation du code** : le contrôle de référence est la validation GitHub.
- **Après une modification distante**, vérifier le commit obtenu et, lorsque disponible, le résultat de la CI avant de poursuivre.

## 9. Validation automatisée

Le workflow `.github/workflows/adpp-validate.yml` est la chaîne de référence. Il s'exécute sur les branches,
les pull requests vers `main` et `main`, et contrôle successivement : dépendances verrouillées, fichiers protégés,
formatage, TypeScript, lint, tests et build de production.

Commande locale équivalente :

```bash
bun run validate
```
