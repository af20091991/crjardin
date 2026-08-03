// « Ce que Pilot Pro comprend » : lecture en langage clair de la situation du
// client, uniquement à partir du score économique déjà calculé et des données
// enregistrées. Aucune donnée inventée : ce qui manque est dit explicitement.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle2, HelpCircle } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import type { ClientScore } from "@/lib/client-score";
import type { ClientActivityStatus } from "@/lib/client-activity";

const ACTIVITY_TEXT: Record<ClientActivityStatus, string> = {
  actif: "la relation est active",
  a_relancer: "la relation s'essouffle et mérite une relance",
  dormant: "la relation est en sommeil",
  perdu: "le client est marqué perdu : il ne génère plus d'action commerciale",
};

export function ClientUnderstandingCard({
  score,
  activityStatus,
  lastActivity,
  ceevCount,
  ceevValue,
  missingHours,
}: {
  score: ClientScore | null;
  activityStatus: ClientActivityStatus;
  lastActivity: string | null;
  ceevCount: number;
  ceevValue: number;
  missingHours: number;
}) {
  const understood: string[] = [];
  const missing: string[] = [];

  if (score) {
    understood.push(
      `Ce client représente ${formatEuro(score.revenueTotalHt)} de chiffre d'affaires cumulé, dont ${formatEuro(score.revenueYearHt)} sur l'exercice en cours.`,
    );
    understood.push(
      `${score.interventionsCount} intervention${score.interventionsCount > 1 ? "s" : ""} enregistrée${score.interventionsCount > 1 ? "s" : ""}, ${score.hoursConfirmed.toFixed(0)} h confirmées.`,
    );
    if (score.realHourlyRate != null && score.targetHourlyRate > 0) {
      const pct = (score.realHourlyRate / score.targetHourlyRate) * 100;
      understood.push(
        `Taux horaire réel de ${formatEuro(score.realHourlyRate)}/h, soit ${pct.toFixed(0)} % de la cible (${formatEuro(score.targetHourlyRate)}/h).`,
      );
    } else {
      missing.push("Heures réelles insuffisantes pour calculer un taux horaire fiable.");
    }
    if (score.opportunitiesCount > 0) {
      understood.push(
        `${score.opportunitiesCount} opportunité${score.opportunitiesCount > 1 ? "s" : ""} en cours pour ${formatEuro(score.opportunitiesValue)}.`,
      );
    }
  } else {
    missing.push("Aucune donnée économique : ni chiffre d'affaires, ni intervention rattachés.");
  }

  understood.push(
    lastActivity
      ? `Dernière activité le ${new Date(lastActivity).toLocaleDateString("fr-FR")} : ${ACTIVITY_TEXT[activityStatus]}.`
      : "Aucune activité datée : la relation est considérée en sommeil.",
  );

  if (ceevCount > 0) {
    understood.push(
      `${ceevCount} contrat${ceevCount > 1 ? "s" : ""} d'entretien rattaché${ceevCount > 1 ? "s" : ""} pour ${formatEuro(ceevValue)} de prix de vente.`,
    );
  } else {
    missing.push("Aucun contrat d'entretien rattaché à ce client.");
  }

  if (missingHours > 0) {
    missing.push(
      `${missingHours} intervention${missingHours > 1 ? "s" : ""} terminée${missingHours > 1 ? "s" : ""} sans heures : la rentabilité affichée est incomplète.`,
    );
  }

  return (
    <Card className="border-primary/25 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary" />
          Ce que Pilot Pro comprend
          {score && (
            <Badge variant="outline" className="ml-auto text-[10px]">
              Confiance {score.confidenceLevel === "HIGH" ? "élevée" : score.confidenceLevel === "MEDIUM" ? "moyenne" : "faible"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1.5">
          {understood.map((t) => (
            <li key={t} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        {missing.length > 0 && (
          <div className="rounded-md border border-dashed border-border bg-background/60 px-3 py-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ce qui manque pour être plus précis
            </p>
            <ul className="space-y-1">
              {missing.map((t) => (
                <li key={t} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {score?.recommendation && (
          <p className="text-sm">
            <span className="font-medium">Lecture Pilot Pro : </span>
            {score.recommendation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}