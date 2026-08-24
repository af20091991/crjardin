import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  useAppearance,
  PRIMARY_PRESETS,
  ACCENT_PRESETS,
  type ThemeMode,
  type Density,
  type Skin,
  type UiTheme,
  type FontChoice,
  type BorderWidth,
  type TextScale,
  type TableDensity,
  type ContentWidth,
  type NavIndicator,
  type AccentSaturation,
  type DarkTint,
  type WeekStart,
  type CardReading,
  type CardStyle,
  type VisualProfile,
  type ValueAlign,
  type LabelLevel,
  type EuroFormat,
  type HoursFormat,
  type PercentFormat,
  CARD_STYLES,
  effectiveCardStyle,
  effectiveValueAlign,
  FONT_GROUPS,
  FONT_STACKS,
} from "@/lib/appearance";

import { Palette, Sun, Moon, Monitor, RotateCcw, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/personnalisation")({
  head: () => ({ meta: [{ title: "Personnalisation — De la graine au jardin" }] }),
  component: PersonnalisationPage,
});

const ALL_GROUPS = ["CR Pro", "SST Pro", "Catalogue Pro", "Pilot Pro", "Administration"];

function Swatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ backgroundColor: color }}
      className={`grid h-9 w-9 place-items-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-105 ${
        active ? "ring-2 ring-foreground" : "ring-1 ring-border"
      }`}
      aria-label={color}
    >
      {active && <Check className="h-4 w-4 text-primary-foreground" />}
    </button>
  );
}

function PersonnalisationPage() {
  const { appearance, setAppearance, reset } = useAppearance();

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Clair", icon: Sun },
    { value: "dark", label: "Sombre", icon: Moon },
    { value: "auto", label: "Auto", icon: Monitor },
  ];
  const densityOptions: { value: Density; label: string }[] = [
    { value: "comfortable", label: "Confortable" },
    { value: "compact", label: "Compact" },
  ];
  const skinOptions: { value: Skin; label: string; hint: string }[] = [
    {
      value: "classic",
      label: "Apparence actuelle",
      hint: "Identité végétale, surfaces chaleureuses et arrondies.",
    },
    {
      value: "modern",
      label: "Apparence moderne",
      hint: "Surfaces sobres, contraste renforcé, tableaux plus respirants.",
    },
  ];

  const toggleGroup = (g: string) => {
    const hidden = appearance.hiddenGroups.includes(g)
      ? appearance.hiddenGroups.filter((x) => x !== g)
      : [...appearance.hiddenGroups, g];
    setAppearance({ hiddenGroups: hidden });
  };

  return (
    <AppShell title="Personnalisation">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Palette className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Apparence de l'application</h2>
            <p className="text-sm text-muted-foreground">
              Choisissez les couleurs, le thème et l'agencement. Les changements s'appliquent
              instantanément sur cet appareil.
            </p>
          </div>
        </div>

        {/* Typographie : 3 rôles indépendants, polices déjà chargées */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-base">Typographie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              25 familles disponibles (sans-serif, serif, display, monospace). « Par défaut du
              thème » conserve le rendu actuel.
            </p>
            {(
              [
                { key: "fontHeading" as const, label: "Titres (h1/h2/h3)" },
                { key: "fontBody" as const, label: "Texte courant (interface, libellés)" },
                { key: "fontNumeric" as const, label: "Valeurs numériques (montants, KPI)" },
              ]
            ).map((role) => (
              <div key={role.key} className="space-y-2">
                <Label htmlFor={role.key}>{role.label}</Label>
                <select
                  id={role.key}
                  value={appearance[role.key]}
                  onChange={(e) => setAppearance({ [role.key]: e.target.value as FontChoice })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  style={
                    appearance[role.key] === "auto"
                      ? undefined
                      : { fontFamily: FONT_STACKS[appearance[role.key] as Exclude<FontChoice, "auto">] }
                  }
                >
                  {FONT_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Nouvelle interface : bascule de jeu de tokens (data-theme) */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-base">Nouvelle interface</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Activer la nouvelle interface</p>
                <p className="text-xs text-muted-foreground">
                  Accent vert mousse, valeurs chiffrées en sérif et espacements plus aérés.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={appearance.ui === "next"}
                aria-label="Nouvelle interface"
                onClick={() =>
                  setAppearance({ ui: (appearance.ui === "next" ? "legacy" : "next") as UiTheme })
                }
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  appearance.ui === "next" ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${
                    appearance.ui === "next" ? "left-[1.375rem]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Réversible à tout moment et conservé sur cet appareil : seuls les tokens visuels
              changent, aucune donnée ni aucun calcul n'est modifié.
            </p>
          </CardContent>
        </Card>

        {/* Apparence globale (skin) */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-base">Apparence générale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {skinOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={appearance.skin === opt.value}
                  onClick={() => setAppearance({ skin: opt.value })}
                  className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                    appearance.skin === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent/30"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {appearance.skin === opt.value && <Check className="h-4 w-4 text-primary" />}
                    {opt.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{opt.hint}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Le changement est immédiat et réversible : aucune donnée, aucun calcul ni aucun statut
              de fiabilité n'est modifié.
            </p>
          </CardContent>
        </Card>

        {/* Thème */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-base">Thème</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAppearance({ theme: opt.value })}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm transition-colors ${
                    appearance.theme === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent/30"
                  }`}
                >
                  <opt.icon className="h-5 w-5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Couleurs */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-base">Couleurs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Couleur principale</Label>
              <div className="flex flex-wrap items-center gap-2">
                {PRIMARY_PRESETS.map((c) => (
                  <Swatch
                    key={c}
                    color={c}
                    active={appearance.primary.toLowerCase() === c.toLowerCase()}
                    onClick={() => setAppearance({ primary: c })}
                  />
                ))}
                <input
                  type="color"
                  value={appearance.primary}
                  onChange={(e) => setAppearance({ primary: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded-full border border-border bg-transparent p-0.5"
                  aria-label="Couleur principale personnalisée"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Couleur d'accent</Label>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_PRESETS.map((c) => (
                  <Swatch
                    key={c}
                    color={c}
                    active={appearance.accent.toLowerCase() === c.toLowerCase()}
                    onClick={() => setAppearance({ accent: c })}
                  />
                ))}
                <input
                  type="color"
                  value={appearance.accent}
                  onChange={(e) => setAppearance({ accent: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded-full border border-border bg-transparent p-0.5"
                  aria-label="Couleur d'accent personnalisée"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Densité & arrondis */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-base">Mise en page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Densité</Label>
              <div className="grid grid-cols-2 gap-2">
                {densityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAppearance({ density: opt.value })}
                    className={`rounded-xl border p-3 text-sm transition-colors ${
                      appearance.density === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Arrondis des coins</Label>
                <span className="text-sm text-muted-foreground">
                  {appearance.radius.toFixed(2)} rem
                </span>
              </div>
              <Slider
                min={0}
                max={1.6}
                step={0.1}
                value={[appearance.radius]}
                onValueChange={([v]) => setAppearance({ radius: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Agencement du menu */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-base">Agencement du menu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Masquez les groupes que vous n'utilisez pas dans la barre latérale.
            </p>
            {ALL_GROUPS.map((g) => {
              const visible = !appearance.hiddenGroups.includes(g);
              return (
                <div
                  key={g}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5"
                >
                  <span className="text-sm font-medium">{g}</span>
                  <button
                    type="button"
                    onClick={() => toggleGroup(g)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      visible ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {visible ? "Affiché" : "Masqué"}
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <CardReadingSettings />

        <VisualSettingsCard />


        <div className="flex justify-end">
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Réinitialiser
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------
   15 réglages visuels supplémentaires.
   Chaque réglage n'agit que sur son propre rôle et sa valeur par défaut
   reproduit exactement le rendu actuel de l'application.
   ------------------------------------------------------------------ */

const SIDEBAR_GROUPS = [
  "Aujourd'hui",
  "Clients",
  "Chantiers",
  "Catalogue",
  "Pilotage",
  "Administration",
];

function SegRow<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              value === o.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-accent/30"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${
            checked ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function VisualSettingsCard() {
  const { appearance, setAppearance } = useAppearance();
  const a = appearance;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-base">Réglages visuels avancés</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Chaque réglage est indépendant et réversible. Les valeurs par défaut reproduisent
          exactement l'affichage actuel.
        </p>

        {/* Cartes & bordures */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cartes & bordures
          </p>
          <SegRow<BorderWidth>
            label="Épaisseur des bordures"
            value={a.borderWidth}
            onChange={(v) => setAppearance({ borderWidth: v })}
            options={[
              { value: "thin", label: "Fin" },
              { value: "normal", label: "Normal" },
              { value: "strong", label: "Marqué" },
            ]}
          />
          <SwitchRow
            label="Ombre au survol des cartes"
            checked={a.cardHoverShadow}
            onChange={(v) => setAppearance({ cardHoverShadow: v })}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Rayon des boutons</Label>
              <span className="text-sm text-muted-foreground">
                {a.buttonRadius === "auto"
                  ? "Comme les cartes"
                  : `${Number(a.buttonRadius).toFixed(2)} rem`}
              </span>
            </div>
            <Slider
              min={0}
              max={1.6}
              step={0.1}
              value={[a.buttonRadius === "auto" ? a.radius : Number(a.buttonRadius)]}
              onValueChange={([v]) => setAppearance({ buttonRadius: v })}
            />
            {a.buttonRadius !== "auto" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAppearance({ buttonRadius: "auto" })}
              >
                Revenir au rayon des cartes
              </Button>
            )}
          </div>
        </div>

        {/* Lisibilité & accessibilité */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lisibilité & accessibilité
          </p>
          <SwitchRow
            label="Contraste renforcé"
            hint="Texte secondaire et bordures accentués."
            checked={a.highContrast}
            onChange={(v) => setAppearance({ highContrast: v })}
          />
          <SegRow<TextScale>
            label="Échelle de texte globale"
            value={a.textScale}
            onChange={(v) => setAppearance({ textScale: v })}
            options={[
              { value: "small", label: "Petit" },
              { value: "normal", label: "Normal" },
              { value: "large", label: "Grand" },
            ]}
          />
          <SwitchRow
            label="Réduire les animations"
            checked={a.reducedMotion}
            onChange={(v) => setAppearance({ reducedMotion: v })}
          />
        </div>

        {/* Densité & mise en page */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Densité & mise en page
          </p>
          <SegRow<TableDensity>
            label="Densité des tableaux"
            hint="Indépendante de la densité générale."
            value={a.tableDensity}
            onChange={(v) => setAppearance({ tableDensity: v })}
            options={[
              { value: "auto", label: "Suivre la densité générale" },
              { value: "comfortable", label: "Confortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
          <SegRow<ContentWidth>
            label="Largeur maximale du contenu"
            value={a.contentWidth}
            onChange={(v) => setAppearance({ contentWidth: v })}
            options={[
              { value: "comfortable", label: "Confortable" },
              { value: "full", label: "Pleine largeur" },
            ]}
          />
        </div>

        {/* Icônes & indicateurs */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Icônes & indicateurs
          </p>
          <SwitchRow
            label="Icônes décoratives"
            hint="Icônes illustratives des cartes et KPI."
            checked={a.decorativeIcons}
            onChange={(v) => setAppearance({ decorativeIcons: v })}
          />
          <SegRow<NavIndicator>
            label="Indicateur du lien actif (barre latérale)"
            value={a.navIndicator}
            onChange={(v) => setAppearance({ navIndicator: v })}
            options={[
              { value: "auto", label: "Actuel (fond coloré)" },
              { value: "dot", label: "Pastille pleine" },
              { value: "bar", label: "Trait fin" },
            ]}
          />
        </div>

        {/* Couleurs */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Couleurs
          </p>
          <SegRow<AccentSaturation>
            label="Saturation de l'accent"
            value={a.accentSaturation}
            onChange={(v) => setAppearance({ accentSaturation: v })}
            options={[
              { value: "soft", label: "Doux" },
              { value: "normal", label: "Normal" },
              { value: "vivid", label: "Vif" },
            ]}
          />
          <SegRow<DarkTint>
            label="Teinte du mode sombre"
            value={a.darkTint}
            onChange={(v) => setAppearance({ darkTint: v })}
            options={[
              { value: "colored", label: "Accent coloré conservé" },
              { value: "neutral", label: "Gris neutre" },
            ]}
          />
        </div>

        {/* Sidebar & navigation */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Barre latérale
          </p>
          <div className="space-y-2">
            <Label htmlFor="defaultOpenGroup">Groupe ouvert par défaut</Label>
            <select
              id="defaultOpenGroup"
              value={a.defaultOpenGroup}
              onChange={(e) => setAppearance({ defaultOpenGroup: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Comportement actuel</option>
              {SIDEBAR_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <SwitchRow
            label="Barre latérale repliée par défaut"
            hint="S'applique tant que vous ne l'avez pas repliée/dépliée manuellement."
            checked={a.sidebarCollapsedDefault}
            onChange={(v) => setAppearance({ sidebarCollapsedDefault: v })}
          />
        </div>

        {/* Régional */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Régional
          </p>
          <SegRow<WeekStart>
            label="Premier jour de la semaine"
            hint="Vues calendrier et planning."
            value={a.weekStart}
            onChange={(v) => setAppearance({ weekStart: v })}
            options={[
              { value: "auto", label: "Par défaut" },
              { value: "monday", label: "Lundi" },
              { value: "sunday", label: "Dimanche" },
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
   Lecture des cartes : présentation uniquement.
   Aucun de ces réglages ne touche une donnée, un calcul ou un KPI.
   ------------------------------------------------------------------ */

function CardReadingSettings() {
  const { appearance, setAppearance } = useAppearance();
  const a = appearance;
  const currentStyle = effectiveCardStyle(a);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-base">Lecture des cartes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Ces réglages ne changent que la présentation : hiérarchie, format d'affichage et
          composition. Les valeurs, calculs et sources restent identiques.
        </p>

        <SegRow<VisualProfile>
          label="Profil visuel"
          hint="Preset global : applique une hiérarchie d'ensemble."
          value={a.visualProfile}
          onChange={(v) => setAppearance({ visualProfile: v })}
          options={[
            { value: "classique", label: "Classique" },
            { value: "pilotage", label: "Pilotage" },
            { value: "epure", label: "Épuré" },
          ]}
        />

        <SegRow<CardReading>
          label="Niveau de lecture des cartes"
          value={a.cardReading}
          onChange={(v) => setAppearance({ cardReading: v })}
          options={[
            { value: "synthetic", label: "Synthétique" },
            { value: "standard", label: "Standard" },
            { value: "detailed", label: "Détaillée" },
          ]}
        />

        <SegRow<"show" | "hide">
          label="Comparaisons sur les cartes"
          hint="N-1, objectif, période précédente ou moyenne, selon ce qui existe déjà pour chaque indicateur."
          value={a.cardComparisons ? "show" : "hide"}
          onChange={(v) => setAppearance({ cardComparisons: v === "show" })}
          options={[
            { value: "show", label: "Afficher" },
            { value: "hide", label: "Masquer" },
          ]}
        />

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Format des valeurs
          </p>
          <SegRow<EuroFormat>
            label="Montants"
            hint="Exemple : 80 400 € ou 80,4 k€."
            value={a.euroFormat}
            onChange={(v) => setAppearance({ euroFormat: v })}
            options={[
              { value: "normal", label: "Normal" },
              { value: "compact", label: "Compact" },
            ]}
          />
          <SegRow<HoursFormat>
            label="Heures"
            hint="Exemple : 533,3 h ou 533 h."
            value={a.hoursFormat}
            onChange={(v) => setAppearance({ hoursFormat: v })}
            options={[
              { value: "decimal", label: "Décimales" },
              { value: "integer", label: "Entières" },
            ]}
          />
          <SegRow<PercentFormat>
            label="Pourcentages"
            hint="Exemple : 34,2 % ou 34 %."
            value={a.percentFormat}
            onChange={(v) => setAppearance({ percentFormat: v })}
            options={[
              { value: "decimal", label: "Décimales" },
              { value: "integer", label: "Entiers" },
            ]}
          />
        </div>

        <SegRow<"left" | "right">
          label="Alignement des valeurs"
          hint="Concerne les valeurs numériques des cartes."
          value={effectiveValueAlign(a)}
          onChange={(v) => setAppearance({ valueAlign: v as ValueAlign })}
          options={[
            { value: "left", label: "Gauche" },
            { value: "right", label: "Droite" },
          ]}
        />

        <SegRow<LabelLevel>
          label="Niveau des libellés"
          hint="« Court » n'est utilisé que lorsqu'un raccourci sans ambiguïté est défini."
          value={a.labelLevel}
          onChange={(v) => setAppearance({ labelLevel: v })}
          options={[
            { value: "full", label: "Complets" },
            { value: "short", label: "Courts" },
          ]}
        />

        <div className="space-y-2">
          <Label>Style des cartes</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {CARD_STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={currentStyle === s.value}
                onClick={() => setAppearance({ cardStyle: s.value as CardStyle })}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  currentStyle === s.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent/30"
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  {currentStyle === s.value && <Check className="h-4 w-4 text-primary" />}
                  {s.label}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{s.hint}</span>
              </button>
            ))}
          </div>
          {a.cardStyle !== "auto" && (
            <Button variant="ghost" size="sm" onClick={() => setAppearance({ cardStyle: "auto" })}>
              Revenir au style du thème
            </Button>
          )}
        </div>

        <SwitchRow
          label="Mode lecture propre"
          hint="Moins de bordures et d'éléments décoratifs, actions secondaires discrètes, davantage de respiration. Aucune information métier n'est supprimée."
          checked={a.cleanReading}
          onChange={(v) => setAppearance({ cleanReading: v })}
        />

        <p className="text-xs text-muted-foreground">
          L'importance visuelle d'une carte (Normal · Important · Prioritaire) se règle directement
          sur la carte, via son menu d'affichage. Le choix est conservé sur cet appareil.
        </p>
      </CardContent>
    </Card>
  );
}
