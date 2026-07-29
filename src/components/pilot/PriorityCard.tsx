// Carte de priorité « Aujourd'hui » : ce qu'il faut faire, pourquoi, d'où
// vient l'information et où agir — avec suivi d'état (À faire / En cours /
// Réalisé / Ignoré).
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACTION_STATUS_BADGE,
  ACTION_STATUS_LABELS,
  type ActionStatus,
} from "@/lib/pilot-action-status";
import { explainPriority } from "@/lib/pilot-priorities";

const STATUS_CHOICES: ActionStatus[] = ["nouvelle", "en_cours", "realisee", "ignoree"];

export function PriorityCard({
  rank,
  itemKey,
  icon: Icon,
  label,
  count,
  topic,
  to,
  search,
  status,
  onStatus,
}: {
  rank: number;
  itemKey: string;
  icon: LucideIcon;
  label: string;
  count: number;
  topic?: string;
  to?: string;
  search?: Record<string, string>;
  status: ActionStatus;
  onStatus: (s: ActionStatus) => void;
}) {
  const info = explainPriority(itemKey);
  const destination: Record<string, unknown> = topic
    ? { to: "/pilot/focus/$topic", params: { topic } }
    : { to: to ?? "/pilot", search };
  const done = status === "realisee" || status === "ignoree";

  return (
    <Card className={cn("h-full transition-all", done && "opacity-60")}>
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-start gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 font-serif text-sm font-semibold text-primary">
            {rank}
          </span>
          <Icon className="mt-1 h-4 w-4 shrink-0 text-primary/80" />
          <p className="min-w-0 flex-1 text-sm font-medium">{label}</p>
          <Badge className="shrink-0">{count}</Badge>
        </div>

        <p className="text-sm text-muted-foreground">{info.why}</p>
        <div className="rounded-md bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Données utilisées : </span>
          {info.source}
        </div>
        <p className="text-xs text-foreground">
          <span className="font-medium">Action : </span>
          {info.action}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {STATUS_CHOICES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "secondary" : "ghost"}
              className={cn("h-7 px-2 text-[11px]", status === s && ACTION_STATUS_BADGE[s])}
              onClick={() => onStatus(s)}
            >
              {ACTION_STATUS_LABELS[s]}
            </Button>
          ))}
          <Link
            {...(destination as { to: string })}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Traiter <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}