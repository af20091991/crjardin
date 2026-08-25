// Centre de contrôle — version simplifiée.
// Une seule question : qu'est-ce que PP peut faire maintenant ?
// Les actions utilisent les fonctions métier existantes et restent journalisées.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle2, History, RefreshCw, Sparkles, TriangleAlert, Undo2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEuro } from "@/lib/pilot";
import { useControlQueue } from "@/components/pilot/useControlQueue";
import { linkEntryToClient } from "@/lib/pilot-ca-matching";
import { classifyCharge, listChargesToClassify, type ChargeTarget } from "@/lib/pilot-fix-flows";
import { clearControlState, setControlState } from "@/lib/pilot-control-log";
import {
  ACTION_LEVEL_META,
  CONTROL_DOMAIN_LABEL,
  CONTROL_STATE_LABEL,
  canAutoApply,
  type ControlAction,
} from "@/lib/pilot-control-queue";

export function ActionQueuePanel() {
  const qc = useQueryClient();
  const { queue, loading, refetchAll } = useControlQueue();
  const chargeRows = useQuery({ queryKey: ["fix-charges"], queryFn: listChargesToClassify });
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
    ]) qc.invalidateQueries({ queryKey: [k] });
  };

  const apply = useMutation({
    mutationFn: async ({ action, auto }: { action: ControlAction; auto: boolean }) => {
      const op = action.operation;
      if (op.kind === "link_ca_client") {
        await linkEntryToClient({
          entryId: op.entryId,
          clientId: op.clientId,
          method: auto ? "bulk" : "suggestion",
          score: op.score,
          note: auto ? "Rapprochement automatique depuis le Centre de contrôle" : "Rapprochement confirmé depuis le Centre de contrôle",
        });
      } else if (op.kind === "classify_charge") {
        const row = (chargeRows.data ?? []).find((c) => c.id === op.chargeId);
        if (!row) throw new Error("Charge introuvable : rechargez la page.");
        await classifyCharge(
          row,
          (row.suggestion?.target ?? "fixe") as ChargeTarget,
          op.category,
          "Classement confirmé depuis le Centre de contrôle",
        );
      } else {
        throw new Error("Cette ligne nécessite une décision dans son écran métier.");
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
      toast.success(v.auto ? "Rapprochement effectué et enregistré." : "Rapprochement confirmé et enregistré.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mark = useMutation({
    mutationFn: (p: { action: ControlAction; state: "justifiee" | "refusee" }) =>
      setControlState({
        key: p.action.key,
        title: p.action.title,
        state: p.state,
        note: p.action.reason,
        detail: { amount: p.action.amount, domain: p.action.domain },
      }),
    onSuccess: () => { toast.success("Décision enregistrée."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const undo = useMutation({
    mutationFn: (a: ControlAction) => clearControlState(a.key, a.title),
    onSuccess: () => { toast.success("La décision a été annulée."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoActions = useMemo(() => queue.actions.filter(canAutoApply), [queue.actions]);
  const visible = showClosed ? queue.closed : queue.actions;
  const s = queue.summary;

  const applyAllAuto = useMutation({
    mutationFn: async () => {
      for (const action of autoActions) await apply.mutateAsync({ action, auto: true });
      return autoActions.length;
    },
    onSuccess: (n) => toast.success(`${n} rapprochement(s) automatique(s) effectué(s).`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SimpleTile label="À traiter" value={s.autoCount + s.suggestionCount + s.manualCount} />
        <SimpleTile label="PP peut rapprocher" value={s.autoCount} tone="text-emerald-700" />
        <SimpleTile label="Votre décision nécessaire" value={s.suggestionCount + s.manualCount} tone="text-orange-700" />
      </div>

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-sm font-semibold">Centre de validation</p>
            <p className="text-xs text-muted-foreground">
              PP traite ce qui est certain. Vous intervenez uniquement lorsqu'un choix est nécessaire.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => applyAllAuto.mutate()}
              disabled={autoActions.length === 0 || applyAllAuto.isPending}
              className="gap-1.5"
            >
              <Wand2 className="h-4 w-4" />
              Rapprocher les {autoActions.length} certains
            </Button>
            <Button size="sm" variant="outline" onClick={invalidate} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Actualiser
            </Button>
            <Button size="sm" variant={showClosed ? "secondary" : "ghost"} onClick={() => setShowClosed((v) => !v)} className="gap-1.5">
              <History className="h-4 w-4" />
              {showClosed ? "À traiter" : `Historique (${s.handled})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-8">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              {showClosed ? "Aucune décision enregistrée." : "Tout est traité. Aucune action en attente."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((action) => (
            <SimpleActionRow
              key={action.key}
              action={action}
              closed={showClosed}
              busy={apply.isPending || mark.isPending || undo.isPending}
              onApply={(auto) => apply.mutate({ action, auto })}
              onMark={(state) => mark.mutate({ action, state })}
              onUndo={() => undo.mutate(action)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SimpleTile({ label, value, tone = "text-foreground" }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-semibold", tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function SimpleActionRow({
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
  onMark: (state: "justifiee" | "refusee") => void;
  onUndo: () => void;
}) {
  const meta = ACTION_LEVEL_META[action.level];
  const canApply = action.level === "auto" || (action.level === "suggestion" && action.operation.kind !== "none");

  return (
    <Card className={cn(action.level === "auto" && "border-emerald-200")}>
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-3">
          {action.level === "auto" ? <Sparkles className="h-4 w-4 text-emerald-600" /> : <TriangleAlert className="h-4 w-4 text-orange-500" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{action.title}</p>
            <p className="text-xs text-muted-foreground">{action.reason}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">{CONTROL_DOMAIN_LABEL[action.domain]}</Badge>
            {action.amount != null && <Badge variant="outline" className="text-[10px]">{formatEuro(action.amount)}</Badge>}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {closed ? (
            <>
              <Badge variant="outline" className="text-[10px]">{CONTROL_STATE_LABEL[action.state]}</Badge>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onUndo} disabled={busy}>
                <Undo2 className="mr-1 h-3 w-3" /> Annuler
              </Button>
            </>
          ) : (
            <>
              {canApply && (
                <Button size="sm" className="h-7 px-2 text-xs" onClick={() => onApply(action.level === "auto")} disabled={busy}>
                  {action.level === "auto" ? "Rapprocher" : action.expectedAction}
                </Button>
              )}
              {!canApply && (
                <Button asChild size="sm" variant="secondary" className="h-7 px-2 text-xs">
                  <Link to={action.to as never} search={{} as never}>
                    {action.expectedAction} <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onMark("justifiee")} disabled={busy}>
                Je garde ainsi
              </Button>
              {action.level === "suggestion" && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onMark("refusee")} disabled={busy}>
                  Refuser
                </Button>
              )}
            </>
          )}
        </div>

        {(action.found || action.missing || action.afterConfirm) && (
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Voir pourquoi</summary>
            <div className="mt-1 space-y-1 rounded-md bg-muted/40 p-2">
              {action.found && <p><strong>Constat :</strong> {action.found}</p>}
              {action.missing && <p><strong>Manque :</strong> {action.missing}</p>}
              {action.afterConfirm && <p><strong>Après :</strong> {action.afterConfirm}</p>}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
