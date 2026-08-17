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
      {active && <Check className="h-4 w-4 text-white" />}
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

        <div className="flex justify-end">
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Réinitialiser
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
