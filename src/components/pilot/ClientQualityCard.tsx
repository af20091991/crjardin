// Bloc « Qualité de la fiche » + assistant de qualification.
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, ArrowRight } from "lucide-react";
import { computeClientQuality, type ClientQualityInput } from "@/lib/client-quality";

export function ClientQualityCard({
  clientId,
  input,
  details,
}: {
  clientId: string;
  input: ClientQualityInput;
  details: Array<{ label: string; value: string }>;
}) {
  const q = computeClientQuality(input, clientId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Qualité de la fiche
          <Badge variant="outline" className="ml-auto text-[10px]">
            Confiance {q.confidenceLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Complétude</span>
            <span className="font-semibold tabular-nums">{q.completeness} %</span>
          </div>
          <Progress value={q.completeness} className="h-2" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {q.attachedCount} élément(s) associé(s) ·{" "}
            {q.lastQualifiedAt
              ? `dernière qualification le ${new Date(q.lastQualifiedAt).toLocaleDateString("fr-FR")}`
              : "aucune qualification manuelle enregistrée"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {details.map((d) => (
            <div key={d.label} className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{d.label}</p>
              <p className="text-sm font-medium tabular-nums">{d.value}</p>
            </div>
          ))}
        </div>

        {q.gaps.length > 0 && (
          <div className="rounded-md border border-dashed p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pour améliorer cette fiche, il manque
            </p>
            <ul className="space-y-1">
              {q.gaps.map((g) => (
                <li key={g.key} className="flex items-center justify-between gap-2 text-sm">
                  <span>☐ {g.label}</span>
                  <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                    <Link to={g.to}>
                      Compléter <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}