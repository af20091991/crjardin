// Centre de contrôle — file d'actions unique et actionnable.
//
// L'écran répond à quatre questions, dans cet ordre :
//   1. qu'est-ce qui est corrigé automatiquement (anomalie certaine) ;
//   2. qu'est-ce qui est proposé et attend une confirmation ;
//   3. qu'est-ce qui exige une décision humaine, et pourquoi ;
//   4. quel est l'état de traçabilité de chaque anomalie.
//
// Aucun calcul métier ici : les corrections appliquées passent par les fonctions
// existantes (rapprochement CA, classement des charges), toutes journalisées.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight, CheckCircle2, ChevronDown, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, Undo2, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEuro } from "@/lib/pilot";
import { useControlQueue } from "@/components/pilot/useControlQueue";
import { linkEntryToClient } from "@/lib/pilot-ca-matching";
import { classifyCharge, listChargesToClassify, type ChargeTarget } from "@/lib/pilot-fix-flows";
import { clearControlState, setControlState } from "@/lib/pilot-control-log";
import {
  ACTION_LEVEL_META,
  CONFIDENCE_LABEL,
  CONTROL_DOMAIN_LABEL,
  CONTROL_STATE_LABEL,
  QUEUE_HELP,
  canAutoApply,
  filterControlActions,
  impactBucket,
  type ActionLevel,
  type ControlAction,
  type ControlDomain,
  type ImpactBucket,
} from "@/lib/pilot-control-queue";

const DOMAINS = Object.keys(CONTROL_DOMAIN_LABEL) as ControlDomain[];
const LEVELS: ActionLevel[] = ["auto", "suggestion", "manuel", "info"];
const IMPACTS: ImpactBucket[] = ["eleve", "modere", "aucun"];

export function ActionQueuePanel() {
  const qc = useQueryClient();
  const { queue, loading, refetchAll } = useControlQueue();
  const chargeRows = useQuery({ queryKey: ["fix-charges"], queryFn: listChargesToClassify });

  const [domain, setDomain] = useState<ControlDomain | "all">("all");
  const [level, setLevel] = useState<ActionLevel | "all">("all");
  const [impact, setImpact] = useState<ImpactBucket | "all">("all");
  const [q, setQ] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  const invalidate = () => {
    refetchAll();
    for (const k of [
      "pilot-control-log",
      "pilot-ca-orphans",
      "pilot-ca-linked-desig",
      "pilot-ca-entries",
      "fix-charges",
      "pilot-quality-center",
      "pilot-analytics",
    ]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };

  /** Applique réellement la correction (fonctions métier existantes). */
  const apply = useMutation({
    mutationFn: async ({ action, auto }: { action: ControlAction; auto: boolean }) => {
      const op = action.operation;
      if (op.kind === "link_ca_client") {
        await linkEntryToClient({
          entryId: op.entryId,
          clientId: op.clientId,
          method: auto ? "bulk" : "suggestion",
          score: op.score,
          note: auto
            ? "Correction automatique sûre depuis le Centre de contrôle"
            : "Suggestion confirmée depuis le Centre de contrôle",
        });
      } else if (op.kind === "classify_charge") {
        const row = (chargeRows.data ?? []).find((c) => c.id === op.chargeId);
        if (!row) throw new Error("Charge introuvable : rechargez la page.");
        await classifyCharge(
          row,
          (row.suggestion?.target ?? "fixe") as ChargeTarget,
          op.category,
          "Classement proposé confirmé depuis le Centre de contrôle",
        );
      } else {
        throw new Error("Aucune correction applicable automatiquement.");
      }
      await setControlState({
        key: action.key,
        title: action.title,
        state: auto ? "corrigee_auto" : "confirmee",
        note: action.expectedAction,
        detail: { amount: action.amount, domain: action.domain },
      });
    },
    onSuccess: (_d, v) => {
      toast.success(v.auto ? "Correction appliquée et journalisée." : "Rattachement confirmé.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mark = useMutation({
    mutationFn: (p: { action: ControlAction; state: "justifiee" | "refusee" | "non_resolue" }) =>
      setControlState({
        key: p.action.key,
        title: p.action.title,
        state: p.state,
        note: p.action.reason,
        detail: { amount: p.action.amount, domain: p.action.domain },
      }),
    onSuccess: () => {
      toast.success("État enregistré : l'anomalie reste traçable.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undo = useMutation({
    mutationFn: (a: ControlAction) => clearControlState(a.key, a.title),
    onSuccess: () => {
      toast.success("Décision annulée : l'anomalie revient dans la file.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoActions = useMemo(() => queue.actions.filter(canAutoApply), [queue.actions]);

  const applyAllAuto = useMutation({
    mutationFn: async () => {
      for (const a of autoActions) await apply.mutateAsync({ action: a, auto: true });
      return autoActions.length;
    },
    onSuccess: (n) => toast.success(`${n} correction(s) sûre(s) appliquée(s).`),
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = useMemo(
    () => filterControlActions(showClosed ? queue.closed : queue.actions, { domain, level, impact, q }),
    [queue, showClosed, domain, level, impact, q],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const s = queue.summary;

  return (
    <div className="space-y-4">
      {/* 1 — Résumé : ce qu'il reste à faire, en une lecture. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          label="Corrections sûres possibles"
          value={s.autoCount}
          tone="text-emerald-700"
          hint="Anomalies certaines, corrigées sans choix métier."
        />
        <SummaryTile
          label="Suggestions à confirmer"
          value={s.suggestionCount}
          tone="text-amber-700"
          hint="Rien n'est appliqué sans votre validation."
        />
        <SummaryTile
          label="Décisions humaines"
          value={s.manualCount}
          tone="text-orange-700"
          hint="Plusieurs issues possibles : à trancher."
        />
        <SummaryTile
          label="Sources indisponibles"
          value={s.unavailableSources}
          tone={s.unavailableSources > 0 ? "text-destructive" : "text-muted-foreground"}
          hint={`${s.uncertifiedKpi} indicateur(s) non certifié(s) pour l'instant.`}
        />
      </div>

      {/* 2 — Mode d'emploi et action de masse sûre. */}
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Comment traiter cette liste
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            {QUEUE_HELP.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => applyAllAuto.mutate()}
              disabled={autoActions.length === 0 || applyAllAuto.isPending}
              className="gap-1.5"
            >
              <Wand2 className="h-4 w-4" />
              Corriger les {autoActions.length} anomalie(s) certaine(s)
            </Button>
            <Button size="sm" variant="outline" onClick={invalidate} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Relancer les contrôles
            </Button>
            <p className="text-xs text-muted-foreground">
              Toute correction est journalisée et annulable ; les formules de CA, charges, heures et
              rentabilité restent inchangées.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3 — Filtres. */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une anomalie…"
          className="h-9 w-full max-w-xs"
        />
        <Select value={domain} onValueChange={(v) => setDomain(v as ControlDomain | "all")}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les domaines</SelectItem>
            {DOMAINS.map((d) => (
              <SelectItem key={d} value={d}>{CONTROL_DOMAIN_LABEL[d]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={(v) => setLevel(v as ActionLevel | "all")}>
          <SelectTrigger className="h-9 w-[210px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types d'action</SelectItem>
            {LEVELS.map((l) => (
              <SelectItem key={l} value={l}>{ACTION_LEVEL_META[l].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={impact} onValueChange={(v) => setImpact(v as ImpactBucket | "all")}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les impacts</SelectItem>
            {IMPACTS.map((i) => (
              <SelectItem key={i} value={i}>
                {i === "eleve" ? "Impact élevé" : i === "modere" ? "Impact modéré" : "Sans montant"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={showClosed ? "secondary" : "ghost"}
          onClick={() => setShowClosed((v) => !v)}
        >
          {showClosed ? "Voir la file active" : `Anomalies traitées (${s.handled})`}
        </Button>
      </div>

      {/* 4 — File d'actions. */}
      {visible.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-6">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              {showClosed
                ? "Aucune anomalie traitée pour ce filtre."
                : "Aucune action en attente pour ce filtre : les données de ce périmètre sont exploitables."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((a) => (
            <ActionRow
              key={a.key}
              action={a}
              closed={showClosed}
              busy={apply.isPending || mark.isPending || undo.isPending}
              onApply={(auto) => apply.mutate({ action: a, auto })}
              onMark={(state) => mark.mutate({ action: a, state })}
              onUndo={() => undo.mutate(a)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("font-display text-2xl font-semibold", tone)}>{value}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ActionRow({
  action,
  closed,
  busy,
  onApply,
  onMark,
  onUndo,
}: {
  action: ControlAction;
  closed: boolean;
  busy: boolean;
  onApply: (auto: boolean) => void;
  onMark: (state: "justifiee" | "refusee" | "non_resolue") => void;
  onUndo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_LEVEL_META[action.level];
  const bucket = impactBucket(action.amount);

  return (
    <Card className={cn("overflow-hidden", action.level === "auto" && "border-emerald-200")}>
      <CardContent className="space-y-2 pt-4">
        <div className="flex flex-wrap items-start gap-2">
          {action.level === "auto" ? (
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">{action.title}</p>
            <p className="text-xs text-muted-foreground">{action.reason}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("text-[10px] font-normal", meta.badge)}>
              {meta.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              {CONTROL_DOMAIN_LABEL[action.domain]}
            </Badge>
            {action.amount != null && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-normal",
                  bucket === "eleve" && "border-destructive/40 text-destructive",
                )}
              >
                {formatEuro(action.amount)}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-1 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground sm:grid-cols-2">
          <p><span className="font-medium text-foreground">Ce qui est trouvé : </span>{action.found}</p>
          <p><span className="font-medium text-foreground">Ce qui manque : </span>{action.missing}</p>
          <p className="sm:col-span-2">
            <span className="font-medium text-foreground">Après confirmation : </span>
            {action.afterConfirm}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {closed ? (
            <>
              <Badge variant="outline" className="text-[10px] font-normal">
                {CONTROL_STATE_LABEL[action.state]}
              </Badge>
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={onUndo} disabled={busy}>
                <Undo2 className="h-3 w-3" /> Annuler la décision
              </Button>
            </>
          ) : (
            <>
              {action.level === "auto" && (
                <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => onApply(true)} disabled={busy}>
                  {action.expectedAction}
                </Button>
              )}
              {action.level === "suggestion" && action.operation.kind !== "none" && (
                <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => onApply(false)} disabled={busy}>
                  {action.expectedAction}
                </Button>
              )}
              {(action.level === "manuel" ||
                action.level === "info" ||
                action.operation.kind === "none") && (
                <Button asChild size="sm" variant="secondary" className="h-7 px-2 text-[11px]">
                  <Link to={action.to as never} search={{} as never}>
                    {action.expectedAction} <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onMark("justifiee")} disabled={busy}>
                Marquer comme justifié
              </Button>
              {action.level === "suggestion" && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onMark("refusee")} disabled={busy}>
                  Refuser la proposition
                </Button>
              )}
              <Badge variant="outline" className="ml-auto text-[10px] font-normal">
                {CONFIDENCE_LABEL[action.confidence]}
              </Badge>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-medium text-primary"
        >
          Voir le détail
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="space-y-1 rounded-md bg-background/60 px-2 py-1.5 text-[11px] text-muted-foreground">
            {action.whyNotAuto && (
              <p>
                <span className="font-medium text-foreground">Pourquoi ce n'est pas automatique : </span>
                {action.whyNotAuto}
              </p>
            )}
            <p>
              <span className="font-medium text-foreground">Indicateurs concernés : </span>
              {action.kpi.join(" · ")}
            </p>
            {action.candidates.length > 0 && (
              <p>
                <span className="font-medium text-foreground">Valeurs candidates : </span>
                {action.candidates.join(" · ")}
              </p>
            )}
            {action.detail.map((d) => (
              <p key={d}>{d}</p>
            ))}
            <p>
              <span className="font-medium text-foreground">État : </span>
              {CONTROL_STATE_LABEL[action.state]}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
