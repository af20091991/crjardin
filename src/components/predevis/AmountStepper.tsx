import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Texte → nombre positif, sinon undefined (vide, non numérique ou négatif). */
function parseText(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

const toText = (n: number | null | undefined) => (n == null ? "" : String(n));

/**
 * Montant ou quantité : saisie libre (au centime) et curseurs − / + qui avancent d'un pas.
 * `step` : 1 pour une quantité, 0,01 pour un montant.
 */
export function AmountStepper({
  value,
  step,
  onChange,
  placeholder,
  label,
  width = "w-32",
  invalid = false,
}: {
  value: number | null | undefined;
  step: number;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  /** Nom lisible pour les lecteurs d'écran. */
  label: string;
  width?: string;
  invalid?: boolean;
}) {
  const [text, setText] = useState(toText(value));

  // Valeur changée ailleurs (autre colonne, nouvelle analyse) : on suit, sans écraser une saisie en cours.
  useEffect(() => {
    setText((t) => (parseText(t) === (value ?? undefined) ? t : toText(value)));
  }, [value]);

  function bump(delta: number) {
    const current = parseText(text) ?? value ?? 0;
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    setText(String(next));
    onChange(next);
  }

  return (
    <div className={`inline-flex items-center justify-end gap-1 ${width}`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        aria-label={`Diminuer ${label}`}
        onClick={() => bump(-step)}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        type="text"
        inputMode="decimal"
        aria-label={label}
        placeholder={placeholder}
        className={`h-8 min-w-0 flex-1 px-2 text-right ${invalid ? "border-destructive" : ""}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseText(e.target.value));
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        aria-label={`Augmenter ${label}`}
        onClick={() => bump(step)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
