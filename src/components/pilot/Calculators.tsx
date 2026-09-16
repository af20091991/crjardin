import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  Trash2,
  ArrowLeftRight,
  Percent,
  Coins,
  HeartHandshake,
} from "lucide-react";
import {
  calcHtToTtc,
  calcTtcToHt,
  calcDechetterie,
  calcSap,
  calcRemise,
} from "@/lib/pilot-ca";
import { formatEuro } from "@/lib/pilot";

function ResultLine({
  label,
  value,
  onUse,
}: {
  label: string;
  value: number;
  onUse?: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t py-1.5 first:border-t-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold tabular-nums">{formatEuro(value)}</span>
        {onUse && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => onUse(Math.round(value * 100) / 100)}
          >
            Utiliser
          </Button>
        )}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8"
      />
    </div>
  );
}

function CalculatorBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-background p-3">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/**
 * All calculation tools share one compact panel and are divided into visual
 * blocks. Calculation formulas and the « Utiliser » callback are unchanged.
 */
export function Calculators({ onUse }: { onUse: (v: number) => void }) {
  const [htv, setHtv] = useState("");
  const [ttcv, setTtcv] = useState("");
  const [kg, setKg] = useState("");
  const [prixT, setPrixT] = useState("42.18");
  const [sapTtc, setSapTtc] = useState("");
  const [remBase, setRemBase] = useState("");
  const [remPct, setRemPct] = useState("");

  const ht = Number(htv) || 0;
  const ttc = Number(ttcv) || 0;
  const dech = calcDechetterie(Number(kg) || 0, Number(prixT) || 0);
  const sap = calcSap(Number(sapTtc) || 0);
  const rem = calcRemise(Number(remBase) || 0, Number(remPct) || 0);
  const htToTtc = calcHtToTtc(ht);
  const ttcToHt = calcTtcToHt(ttc);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" /> Calculateurs
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 md:grid-cols-2">
          <CalculatorBlock title="HT ⇆ TTC (20 %)" icon={ArrowLeftRight}>
            <NumField label="Montant HT" value={htv} onChange={setHtv} />
            <ResultLine label="TVA" value={htToTtc.tva} />
            <ResultLine label="TTC" value={htToTtc.ttc} />
            <NumField label="Montant TTC" value={ttcv} onChange={setTtcv} />
            <ResultLine label="TVA" value={ttcToHt.tva} />
            <ResultLine label="HT" value={ttcToHt.ht} onUse={onUse} />
          </CalculatorBlock>

          <CalculatorBlock title="Déchèterie" icon={Trash2}>
            <NumField label="Kg vidés" value={kg} onChange={setKg} />
            <NumField label="Prix HT / tonne (€)" value={prixT} onChange={setPrixT} />
            <ResultLine label="Coût déchets" value={dech.cout} onUse={onUse} />
          </CalculatorBlock>

          <CalculatorBlock title="SAP (ASAP 1,07)" icon={HeartHandshake}>
            <NumField label="TTC facturé (€)" value={sapTtc} onChange={setSapTtc} />
            <ResultLine label="TVA" value={sap.tva} />
            <ResultLine label="Montant reversé" value={sap.montantReverse} />
            <ResultLine label="HT reversé" value={sap.htReverse} onUse={onUse} />
          </CalculatorBlock>

          <CalculatorBlock title="Montant remisé" icon={Percent}>
            <NumField label="Somme initiale (€)" value={remBase} onChange={setRemBase} />
            <NumField label="% remise" value={remPct} onChange={setRemPct} />
            <ResultLine label="Remise" value={rem.remise} />
            <ResultLine label="Prix net" value={rem.net} onUse={onUse} />
          </CalculatorBlock>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Coins className="h-3 w-3" /> « Utiliser » reporte le montant HT dans la nouvelle ligne.
        </p>
      </CardContent>
    </Card>
  );
}
