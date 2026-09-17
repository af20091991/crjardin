import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Calculator, Trash2, ArrowLeftRight, Percent, Coins, HeartHandshake } from "lucide-react";
import {
  calcHtToTtc, calcTtcToHt, calcDechetterie, calcSap, calcRemise,
} from "@/lib/pilot-ca";
import { formatEuro } from "@/lib/pilot";

function ResultLine({ label, value, onUse }: { label: string; value: number; onUse?: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold tabular-nums">{formatEuro(value)}</span>
        {onUse && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onUse(Math.round(value * 100) / 100)}>
            Utiliser
          </Button>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="h-8" />
    </div>
  );
}

/** onUse: reporte un montant HT calculé dans le formulaire de saisie actif. */
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
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" /> Calculateurs
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" defaultValue={["htttc"]} className="w-full">
          <AccordionItem value="htttc">
            <AccordionTrigger className="text-sm"><span className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" />HT ⇆ TTC (20 %)</span></AccordionTrigger>
            <AccordionContent className="space-y-2">
              <NumField label="Montant HT" value={htv} onChange={setHtv} />
              <ResultLine label="TVA" value={htToTtc.tva} />
              <ResultLine label="TTC" value={htToTtc.ttc} />
              <div className="my-1 border-t" />
              <NumField label="Montant TTC" value={ttcv} onChange={setTtcv} />
              <ResultLine label="TVA" value={ttcToHt.tva} />
              <ResultLine label="HT" value={ttcToHt.ht} onUse={onUse} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dech">
            <AccordionTrigger className="text-sm"><span className="flex items-center gap-2"><Trash2 className="h-4 w-4" />Déchèterie</span></AccordionTrigger>
            <AccordionContent className="space-y-2">
              <NumField label="Kg vidés" value={kg} onChange={setKg} />
              <NumField label="Prix HT / tonne (€)" value={prixT} onChange={setPrixT} />
              <ResultLine label="Coût déchets" value={dech.cout} onUse={onUse} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sap">
            <AccordionTrigger className="text-sm"><span className="flex items-center gap-2"><HeartHandshake className="h-4 w-4" />SAP (ASAP 1,07)</span></AccordionTrigger>
            <AccordionContent className="space-y-2">
              <NumField label="TTC facturé (€)" value={sapTtc} onChange={setSapTtc} />
              <ResultLine label="TVA" value={sap.tva} />
              <ResultLine label="Montant reversé" value={sap.montantReverse} />
              <ResultLine label="HT reversé" value={sap.htReverse} onUse={onUse} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="remise">
            <AccordionTrigger className="text-sm"><span className="flex items-center gap-2"><Percent className="h-4 w-4" />Montant remisé</span></AccordionTrigger>
            <AccordionContent className="space-y-2">
              <NumField label="Somme initiale (€)" value={remBase} onChange={setRemBase} />
              <NumField label="% remise" value={remPct} onChange={setRemPct} />
              <ResultLine label="Remise" value={rem.remise} />
              <ResultLine label="Prix net" value={rem.net} onUse={onUse} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Coins className="h-3 w-3" /> « Utiliser » reporte le montant HT dans la nouvelle ligne.
        </p>
      </CardContent>
    </Card>
  );
}
