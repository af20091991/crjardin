# Phase 2 — Plan technique détaillé : Référentiel économique

## 1. Schéma SQL

### 1.1 Catalogue prestations

```sql
-- Catégories de prestations (Entretien, Création, Conseil, Irrigation, Autres)
CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,              -- slug stable : 'entretien', 'creation'...
  label text NOT NULL,
  color text,                       -- pour affichage futur
  position int NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

-- Prestations (catalogue)
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  code text NOT NULL,               -- slug stable
  label text NOT NULL,
  description text,
  unit text NOT NULL,               -- 'heure' | 'm2' | 'forfait' | 'jour' | 'unite'
  standard_duration_hours numeric(6,2),  -- durée standard en heures (nullable si forfait)
  default_frequency text,           -- 'ponctuel' | 'mensuel' | 'trimestriel' | 'annuel'
  is_recurring boolean NOT NULL DEFAULT false,  -- pour futur module contrats
  tags text[] NOT NULL DEFAULT '{}',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

-- Historique tarifaire d'une prestation
CREATE TABLE public.service_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  price_ht numeric(12,2) NOT NULL,          -- prix vente HT par unité
  material_cost numeric(12,2) NOT NULL DEFAULT 0,  -- coût matière moyen
  tva_rate numeric(5,2) NOT NULL DEFAULT 20,
  valid_from date NOT NULL,
  valid_to date,                             -- NULL = en cours
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Saisonnalité — deux niveaux : catégorie (défaut) + surcharge prestation
CREATE TABLE public.service_seasonality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('category','service')),
  category_id uuid REFERENCES public.service_categories(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  intensity numeric(4,2) NOT NULL DEFAULT 1  -- 0 à 3 (1 = normal)
    CHECK (intensity >= 0 AND intensity <= 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'category' AND category_id IS NOT NULL AND service_id IS NULL) OR
    (scope = 'service'  AND service_id  IS NOT NULL AND category_id IS NULL)
  ),
  UNIQUE (user_id, scope, category_id, service_id, month)
);
```

### 1.2 Référentiel temps

```sql
-- Catégories de temps : productif facturable, déplacement, admin, commercial, préparation…
CREATE TABLE public.time_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  is_billable boolean NOT NULL DEFAULT false,
  color text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

-- Standard = journée type cible : % par catégorie, historisé
CREATE TABLE public.time_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_category_id uuid NOT NULL REFERENCES public.time_categories(id) ON DELETE CASCADE,
  target_ratio numeric(5,4) NOT NULL CHECK (target_ratio >= 0 AND target_ratio <= 1),
  hours_per_day numeric(4,2) NOT NULL DEFAULT 8,
  working_days_per_year int NOT NULL DEFAULT 220,
  valid_from date NOT NULL,
  valid_to date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Contrainte "somme = 1 par période" : validée via trigger (voir 4).
```

### 1.3 Référentiel charges

```sql
CREATE TABLE public.charge_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fixe','variable','vehicule','materiel','autre')),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

-- Charges récurrentes (loyer, assurance, abonnement...)
CREATE TABLE public.charges_recurring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charge_category_id uuid NOT NULL REFERENCES public.charge_categories(id) ON DELETE RESTRICT,
  label text NOT NULL,
  amount_ht numeric(12,2) NOT NULL,
  periodicity text NOT NULL CHECK (periodicity IN ('mensuel','trimestriel','semestriel','annuel')),
  valid_from date NOT NULL,
  valid_to date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Coûts variables unitaires (carburant/km, consommables/m²...)
CREATE TABLE public.charges_variable_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charge_category_id uuid NOT NULL REFERENCES public.charge_categories(id) ON DELETE RESTRICT,
  label text NOT NULL,
  unit text NOT NULL,                 -- 'km' | 'litre' | 'm2' | 'heure'...
  amount_per_unit numeric(12,4) NOT NULL,
  valid_from date NOT NULL,
  valid_to date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Achats ponctuels / investissements (amortissement optionnel)
CREATE TABLE public.charges_one_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charge_category_id uuid NOT NULL REFERENCES public.charge_categories(id) ON DELETE RESTRICT,
  label text NOT NULL,
  amount_ht numeric(12,2) NOT NULL,
  purchase_date date NOT NULL,
  amortization_months int,            -- NULL = charge sèche
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## 2. Relations (résumé)

```text
service_categories 1─n services 1─n service_prices
                       └─n service_seasonality (scope=service)
service_categories 1─n service_seasonality (scope=category)

time_categories 1─n time_standards

charge_categories 1─n charges_recurring
                  1─n charges_variable_rates
                  1─n charges_one_off
```

Aucune FK vers les tables opérationnelles (`interventions`, `pilot_ca_entries`) : le référentiel reste indépendant. Le lien se fera plus tard via `service_id` optionnel sur les lignes CA / interventions (Phase 3+).

## 3. RLS & GRANT (motif appliqué à toutes les tables)

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
GRANT ALL ON public.<table> TO service_role;
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rows read"   ON public.<table> FOR SELECT TO authenticated USING  (auth.uid() = user_id);
CREATE POLICY "own rows write"  ON public.<table> FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rows update" ON public.<table> FOR UPDATE TO authenticated USING  (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rows delete" ON public.<table> FOR DELETE TO authenticated USING  (auth.uid() = user_id);
```

Chaque table strictement isolée par `user_id`. Pas de grant `anon`.

## 4. Règles d'intégrité

- Historisation : contrainte `EXCLUDE USING gist` sur `(user_id, service_id, daterange(valid_from, valid_to, '[)'))` pour `service_prices`, idem pour `charges_recurring`, `charges_variable_rates`, `time_standards` — interdit les chevauchements de périodes.
- `service_seasonality` : contrainte CHECK garantit l'exclusivité `category`/`service` + unicité (user, scope, cible, mois).
- `time_standards` : trigger `AFTER INSERT/UPDATE` vérifie que la somme des `target_ratio` actifs à une date donnée = 1 (±0.01). Warning non bloquant si écart (avertit sans casser).
- Trigger `update_updated_at_column()` (déjà existant) branché sur toutes les tables avec `updated_at`.
- Toutes les FK vers `service_categories`/`charge_categories` en `ON DELETE RESTRICT` : impossible de supprimer une catégorie utilisée.

## 5. Vues SQL (moteur de calcul)

Toutes en `SECURITY INVOKER` (respectent la RLS de l'appelant).

```sql
-- v_service_current_price : prix en cours par prestation
CREATE VIEW public.v_service_current_price AS
SELECT DISTINCT ON (service_id)
  service_id, price_ht, material_cost, tva_rate, valid_from
FROM public.service_prices
WHERE valid_from <= CURRENT_DATE AND (valid_to IS NULL OR valid_to > CURRENT_DATE)
ORDER BY service_id, valid_from DESC;

-- v_service_seasonality_resolved : saisonnalité effective (surcharge prestation sinon catégorie)
CREATE VIEW public.v_service_seasonality_resolved AS
SELECT s.id AS service_id, m.month,
       COALESCE(ss_srv.intensity, ss_cat.intensity, 1) AS intensity
FROM public.services s
CROSS JOIN generate_series(1,12) AS m(month)
LEFT JOIN public.service_seasonality ss_srv
  ON ss_srv.scope='service' AND ss_srv.service_id=s.id AND ss_srv.month=m.month
LEFT JOIN public.service_seasonality ss_cat
  ON ss_cat.scope='category' AND ss_cat.category_id=s.category_id AND ss_cat.month=m.month;

-- v_charges_monthly : total charges mensualisées (récurrentes + amortissements)
CREATE VIEW public.v_charges_monthly AS
SELECT user_id,
  SUM(CASE periodicity
        WHEN 'mensuel' THEN amount_ht
        WHEN 'trimestriel' THEN amount_ht/3
        WHEN 'semestriel' THEN amount_ht/6
        WHEN 'annuel' THEN amount_ht/12
      END) AS monthly_recurring
FROM public.charges_recurring
WHERE valid_from <= CURRENT_DATE AND (valid_to IS NULL OR valid_to > CURRENT_DATE)
GROUP BY user_id;

-- v_billable_hours_target : heures productives cibles / an
CREATE VIEW public.v_billable_hours_target AS
SELECT ts.user_id,
       SUM(ts.target_ratio * ts.hours_per_day * ts.working_days_per_year)
         FILTER (WHERE tc.is_billable) AS billable_hours_year
FROM public.time_standards ts
JOIN public.time_categories tc ON tc.id = ts.time_category_id
WHERE ts.valid_from <= CURRENT_DATE AND (ts.valid_to IS NULL OR ts.valid_to > CURRENT_DATE)
GROUP BY ts.user_id;

-- v_real_hourly_cost : coût horaire réel = charges annuelles / heures facturables cibles
CREATE VIEW public.v_real_hourly_cost AS
SELECT c.user_id,
       (c.monthly_recurring * 12) / NULLIF(h.billable_hours_year, 0) AS real_hourly_cost
FROM public.v_charges_monthly c
LEFT JOIN public.v_billable_hours_target h USING (user_id);

-- v_service_margin : marge brute par prestation à l'instant t
CREATE VIEW public.v_service_margin AS
SELECT s.id AS service_id, s.label, s.unit, s.standard_duration_hours,
       p.price_ht, p.material_cost,
       rhc.real_hourly_cost,
       (p.price_ht
         - p.material_cost
         - COALESCE(s.standard_duration_hours,0) * COALESCE(rhc.real_hourly_cost,0)
       ) AS gross_margin
FROM public.services s
JOIN public.v_service_current_price p ON p.service_id = s.id
LEFT JOIN public.v_real_hourly_cost rhc ON rhc.user_id = s.user_id;
```

## 6. Stratégie de migration

Une seule migration SQL (Phase 2a — schéma) puis import initial validé (Phase 2b — données).

Phase 2a — schéma (aucune donnée touchée) :
1. Création des 9 tables + vues + triggers.
2. Aucune suppression de `pilot_charges` ni d'aucune table existante. Cohabitation totale.
3. Vérif linter Supabase.

Phase 2b — analyse & import initial (proposé pour validation avant écriture) :
1. Extraction distincte des `designation` de `pilot_ca_entries` (kind='vente'), regroupement par similarité → catégorie proposée.
2. Extraction des types de services depuis `interventions` (`intervention_type`) et fiches chantier.
3. Génération d'un fichier de proposition (catalogue candidat) : catégorie, libellé, unité, durée standard, prix moyen déduit, fréquence estimée.
4. Écran de validation dans Réglages > Import (hors périmètre de la migration SQL).
5. Aucune insertion en base sans validation utilisateur ligne à ligne.

Migration ultérieure de `pilot_charges` (Phase 2c, séparée, non exécutée maintenant) :
- Rapport d'analyse : mapping `pilot_charges` → `charges_recurring` / `charges_one_off`.
- Aucune suppression avant validation explicite.

## 7. Interface (préparation seulement, pas dans cette migration)

Trois entrées séparées dans le menu Référentiels :
- Catalogue prestations (services, catégories, prix, saisonnalité)
- Organisation du temps (time_categories + time_standards)
- Charges & coûts (charge_categories + recurring/variable/one-off)

Le développement de ces écrans se fera après validation du plan technique et exécution de la migration schéma.

## 8. Évolutivité prévue (fondations, non implémentées)

- Ajout futur d'un champ `service_id` optionnel sur `pilot_ca_entries` et `interventions` pour rattacher le réel au référentiel.
- Table `service_contracts` (contrats d'entretien récurrents) prévue en Phase 3 : référencera `services` avec `is_recurring=true` pour calculer le CA sécurisé futur.
- `time_entries` réintroduisible plus tard sans casser le modèle : `time_standards` reste le cible, `time_entries` deviendrait le réel granulaire.

## 9. Livrables de la Phase 2a (à exécuter après validation)

1. Migration SQL unique contenant : 9 tables, GRANTs, RLS, policies, triggers, 6 vues.
2. Régénération des types Supabase (automatique après migration).
3. Rapport : objets créés, contraintes posées, index, vues, impacts perf/sécurité/évolutivité.

Aucun code applicatif, aucun écran, aucune donnée modifiée dans cette étape. Validation demandée avant d'exécuter la migration.
