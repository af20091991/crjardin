// Affichage unique du niveau de confiance d'un indicateur Pilot Pro :
// identité économique + source des heures + couverture. Aucun calcul ici.
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export function ReliabilityBadge({
  reliability,
  compact,
  clientId,
  clientLabel,
}: {
  reliability: Reliability;
  compact?: boolean;
  /** Fiche concernée : active le diagnostic « pourquoi provisoire ? » en 2 clics. */
  clientId?: string | null;
  clientLabel?: string;
}) {
  const badge = (
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

  // Diagnostic accessible en 2 clics : 1) ouvrir la cause, 2) ouvrir la donnée
  // responsable. Aucune règle de calcul n'est modifiée ici.
  if (!clientId || reliability.level === "fiable") return badge;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-help" title="Pourquoi ce statut ?">
          {badge}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 text-xs">
        <p className="font-medium text-foreground">{reliability.label}</p>
        {clientLabel && <p className="text-muted-foreground">{clientLabel}</p>}
        {reliability.reasons.length > 0 ? (
          <ul className="space-y-1 text-muted-foreground">
            {reliability.reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Aucun motif détaillé disponible.</p>
        )}
        <p className="text-muted-foreground">
          Heures utilisées : {reliability.hoursSourceLabel}. Identité économique :{" "}
          {reliability.entity.warning ?? "exploitable"}.
        </p>
        <div className="flex flex-col gap-1 border-t pt-2">
          <Link
            to="/pilot/fiche/$clientId"
            params={{ clientId }}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Ouvrir les données du client (CA et Vente → Temps)
          </Link>
          <Link
            to="/pilot/qualite"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Corriger dans le centre de qualité des données
          </Link>
        </div>
      </PopoverContent>
    </Popover>
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
