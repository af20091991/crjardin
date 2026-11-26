import type { SstMode } from "@/lib/sst-charges";

/**
 * Qualifie une charge SST en un clic : « Autonome » (le prestataire réalise seul la mission)
 * ou « Chantier » (vous participez : le coût est une charge de chantier). Cliquer sur le choix
 * déjà actif le remet à « à qualifier ».
 */
export function SstModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: SstMode | null | undefined;
  onChange: (value: SstMode | null) => void;
  disabled?: boolean;
}) {
  const option = (mode: SstMode, label: string, title: string) => {
    const active = value === mode;
    return (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={active}
        title={title}
        onClick={() => onChange(active ? null : mode)}
        className={`h-7 rounded-md border px-2 text-xs transition-colors disabled:opacity-50 ${
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input text-muted-foreground hover:bg-muted/40"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="inline-flex gap-1" role="group" aria-label="Type de sous-traitance">
      {option(
        "autonome",
        "Autonome",
        "Le prestataire réalise seul la mission : marge = prix client − coût SST",
      )}
      {option(
        "accompagnee",
        "Chantier",
        "Vous participez au chantier : le coût SST est une charge de chantier",
      )}
    </div>
  );
}
