// Contrat de vérité des KPI — panneau de diagnostic (lecture seule).
// Affiche uniquement les métadonnées du registre (src/lib/pilot-kpi-contract.ts).
// Aucune valeur métier n'est calculée ni affichée ici.
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, Search } from "lucide-react";
import {
  KPI_CATEGORY_LABEL,
  KPI_CONTRACTS,
  KPI_RELIABILITY_LABEL,
  getKpiContract,
  type KpiContract,
  type KpiReliabilityStatus,
} from "@/lib/pilot-kpi-contract";

const UNIT_LABEL: Record<KpiContract["unit"], string> = {
  eur: "€ HT",
  heures: "heures",
  pct: "%",
  eur_heure: "€/h",
  nombre: "nombre",
};

function reliabilityVariant(status: KpiReliabilityStatus): "secondary" | "outline" | "destructive" {
  if (status === "certifie") return "secondary";
  if (status === "a_documenter") return "outline";
  return "destructive";
}

export function KpiContractPanel() {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [...KPI_CONTRACTS];
    return KPI_CONTRACTS.filter(
      (c) =>
        c.label.toLowerCase().includes(needle) ||
        c.id.toLowerCase().includes(needle) ||
        KPI_CATEGORY_LABEL[c.category].toLowerCase().includes(needle),
    );
  }, [q]);

  const lookup = q.trim() ? getKpiContract(q.trim()) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Contrat de vérité des indicateurs ({KPI_CONTRACTS.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Documentation de référence : pour chaque indicateur stratégique, sa fonction source
            officielle, sa source de données, sa période, son périmètre et sa règle de
            disponibilité. Aucun calcul n'est effectué sur cet écran.
          </p>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un indicateur ou un identifiant"
              className="pl-8"
              aria-label="Rechercher un indicateur du contrat"
            />
          </div>
          {lookup && !lookup.found && rows.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {lookup.reason}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-sm">{c.label}</CardTitle>
                <Badge variant={reliabilityVariant(c.reliabilityStatus)} className="font-normal">
                  {KPI_RELIABILITY_LABEL[c.reliabilityStatus]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="font-mono font-normal">
                  {c.id}
                </Badge>
                <span>{KPI_CATEGORY_LABEL[c.category]}</span>
                <span aria-hidden>•</span>
                <span>Unité : {UNIT_LABEL[c.unit]}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p>
                <span className="font-medium">Fonction source :</span>{" "}
                <span className="text-muted-foreground">{c.calculationReference}</span>
              </p>
              <p>
                <span className="font-medium">Source de données :</span>{" "}
                <span className="text-muted-foreground">{c.source.join(", ")}</span>
              </p>
              <p>
                <span className="font-medium">Période :</span>{" "}
                <span className="text-muted-foreground">{c.period}</span>
              </p>
              <p>
                <span className="font-medium">Périmètre :</span>{" "}
                <span className="text-muted-foreground">{c.scope}</span>
              </p>
              <p>
                <span className="font-medium">Filtres :</span>{" "}
                <span className="text-muted-foreground">{c.filters.join(" · ")}</span>
              </p>
              <p>
                <span className="font-medium">Exclusions :</span>{" "}
                <span className="text-muted-foreground">{c.excludes.join(" · ")}</span>
              </p>
              <p>
                <span className="font-medium">Données absentes :</span>{" "}
                <span className="text-muted-foreground">{c.missingDataRule}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
