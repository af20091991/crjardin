// Affichage unique du niveau de confiance d'un indicateur Pilot Pro :
// identité économique + source des heures + couverture. Aucun calcul ici.
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, BadgeCheck, HelpCircle, ShieldAlert } from "lucide-react";
import {
  ENTITY_STATUS_META,
} from "@/lib/pilot-referential";
import {
  entityEligibility,
  HOURS_SOURCE_META,
  type HoursSourceKey,
  type Reliability,
} from "@/lib/pilot-entity-rules";

export function EntityStatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const e = entityEligibility(status);
  const meta = ENTITY_STATUS_META[e.status];
  return (
    <Badge variant="outline" className={`gap-1 font-normal ${meta.badge} ${className ?? ""}`} title={e.warning ?? meta.hint}>
      {e.status === "certified_client" ? (
        <BadgeCheck className="h-3 w-3" />
      ) : e.level === "non_fiable" ? (
        <ShieldAlert className="h-3 w-3" />
      ) : (
        <HelpCircle className="h-3 w-3" />
      )}
      {meta.short}
    </Badge>
  );
}

const TONE: Record<Reliability["level"], string> = {
  fiable: "border-emerald-200 bg-emerald-50 text-emerald-700",
  provisoire: "border-amber-200 bg-amber-50 text-amber-800",
  non_fiable: "border-red-200 bg-red-50 text-red-700",
};

export function ReliabilityBadge({ reliability, compact }: { reliability: Reliability; compact?: boolean }) {
  return (
    <Badge
      variant="outline"
      className={`gap-1 font-normal ${TONE[reliability.level]}`}
      title={[reliability.label, ...reliability.reasons].join(" · ")}
    >
      {reliability.level === "fiable" ? (
        <BadgeCheck className="h-3 w-3" />
      ) : (
        <AlertTriangle className="h-3 w-3" />
      )}
      {compact
        ? reliability.level === "fiable"
          ? "Fiable"
          : reliability.level === "provisoire"
            ? "Provisoire"
            : "Non fiable"
        : reliability.label}
    </Badge>
  );
}

/** Bandeau de traçabilité d'un calcul : heures utilisées, source, période, confiance. */
export function AnalysisTraceability(props: {
  hours: number;
  hoursSource: HoursSourceKey;
  period: string;
  reliability: Reliability;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Heures utilisées :{" "}
          <strong className="text-foreground">
            {props.hours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h
          </strong>
        </span>
        <span>Source : {HOURS_SOURCE_META[props.hoursSource].label}</span>
        <span>Période : {props.period}</span>
        <ReliabilityBadge reliability={props.reliability} compact />
      </div>
      {props.reliability.reasons.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {props.reliability.reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
