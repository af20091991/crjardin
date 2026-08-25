// Centre de validation — interface volontairement simple.
// Objectif : PP fait ce qu'il peut, l'utilisateur ne voit que ce qui demande une décision.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, History, RefreshCw, Sparkles, ArrowRight, Undo2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEuro } from "@/lib/pilot";
import { useControlQueue } from "@/components/pilot/useControlQueue";
import { linkEntryToClient } from "@/lib/pilot-ca-matching";
import { classifyCharge, listChargesToClassify, type ChargeTarget } from "@/lib/pilot-fix-flows";
import { clearControlState, setControlState } from "@/lib/pilot-control-log";
import { canAutoApply, type ControlAction } from "@/lib/pilot-control-queue";

export function ActionQueuePanel() {
  const qc = useQueryClient();
  const { queue, loading, refetchAll } = useControlQueue();
  const chargeRows = useQuery({ queryKey: ["fix-charges"], queryFn: listChargesToClassify });
  const [showHistory, setShowHistory] = useState(false);

  const refresh = () => {
    refetchAll();
    for (const key of ["pilot-control-log", "pilot-ca-orphans", "pilot-ca-linked-desig", "pilot-ca-entries", "fix-charges", "pilot-quality-center", "pilot-analytics"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };

  const apply = useMutation({
    mutationFn: async ({ action, automatic }: { action: ControlAction; automatic: boolean }) => {
      const op = action.operation;
      if (op.kind === "link_ca_client") {
        await linkEntryToClient({
          entryId: op.entryId,
          clientId: op.clientId,
          method: automatic ? "bulk" : "suggestion",
          score: op.score,
          note: automatic ? "Rapprochement automatique par PP" : "Rapprochement confirmé par l'utilisateur",
        });
      } else if (op.kind === "classify_charge") {
        const row = (chargeRows.data ?? []).find((c) => c.id === op.chargeId);
        if (!row) throw new Error("La donnée n'est plus disponible. Actualisez la page.");
        await classifyCharge(row, (row.suggestion?.target ?? "fixe") as ChargeTarget, op.category, "Classement confirmé depuis le Centre de validation");
      } else {
        throw new Error("Cette donnée doit être traitée dans son écran dédié.");
      }
      await setControlState({
        key: action.key,
        title: action.title,
        state: automatic ? "corrigee_auto" : "confirmee",
        note: automatic ? "Effectué automatiquement par PP" : "Confirmé par l'utilisateur",
        detail: { amount: action.amount, domain: action.domain },
      });
    },
    onSuccess: (_d, v) => {
      toast.success(v.automatic ? "PP a effectué le rapprochement." : "C'est enregistré.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mark = useMutation({
    mutationFn: (action: ControlAction) => setControlState({
      key: action.key,
      title: action.title,
      state: "justifiee",
      note: "Conservé tel quel par l'utilisateur",
      detail: { amount: action.amount, domain: action.domain },
    }),
    onSuccess: () => { toast.success("C'est enregistré."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const undo = useMutation({
    mutationFn: (action: ControlAction) => clearControlState(action.key, action.title),
    onSuccess: () => { toast.success("La décision a été annulée."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const automatic = useMemo(() => queue.actions.filter(canAutoApply), [queue.actions]);
  const decisions = useMemo(() => queue.actions.filter((a) => !canAutoApply(a)), [queue.actions]);
  const visible = showHistory ? queue.closed : queue.actions;
  const busy = apply.isPending || mark.isPending || undo.isPending;
  const remaining = queue.summary.autoCount + queue.summary.suggestionCount + queue.summary.manualCount;

  const applyAll = useMutation({
    mutationFn: async () => {
      let done = 0;
      for (const action of automatic) {
        await apply.mutateAsync({ action, automatic: true });
        done++;
      }
      return done;
    },
    onSuccess: (n) => toast.success(`${n} rapprochement(s) effectué(s) par PP.`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="space-y-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-48 w-full" /></div>;

  if (showHistory) {
    return (
      <div className="space-y-4">
        <Header onRefresh={refresh} onHistory={() => setShowHistory(false)} historyLabel="Retour aux données à traiter" />
        {visible.length === 0 ? <Empty text="Aucune donnée traitée pour le moment." /> : (
          <div className="space-y-2">{visible.map((a) => <HistoryRow key={a.key} action={a} onUndo={() => undo.mutate(a)} busy={busy} />)}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header onRefresh={refresh} onHistory={() => setShowHistory(true)} historyLabel={`Voir l'historique (${queue.summary.handled})`} />

      <div className="grid gap-3 sm:grid-cols-3">
        <CountCard label="À traiter" value={remaining} />
        <CountCard label="PP peut faire seul" value={automatic.length} tone="text-emerald-700" />
        <CountCard label="Votre décision" value={decisions.length} tone="text-orange-700" />
      </div>

      {automatic.length > 0 && (
        <section className="space-y-3">
          <SectionTitle title="PP peut le faire" subtitle="Ces rapprochements sont suffisamment sûrs pour être faits sans vous." />
          <Button onClick={() => applyAll.mutate()} disabled={applyAll.isPending || busy} className="w-full sm:w-auto">
            <Wand2 className="mr-2 h-4 w-4" /> Faire les {automatic.length} rapprochements sûrs
          </Button>
          <div className="space-y-2">{automatic.map((a) => <ActionRow key={a.key} action={a} onApply={() => apply.mutate({ action: a, automatic: true })} busy={busy} />)}</div>
        </section>
      )}

      {decisions.length > 0 && (
        <section className="space-y-3">
          <SectionTitle title="Votre décision est nécessaire" subtitle="PP ne choisit pas à votre place." />
          <div className="space-y-2">{decisions.map((a) => <ActionRow key={a.key} action={a} onApply={() => apply.mutate({ action: a, automatic: false })} onKeep={() => mark.mutate(a)} busy={busy} />)}</div>
        </section>
      )}

      {remaining === 0 && <Empty text="Tout est traité. Il n'y a rien à faire ici." />}
    </div>
  );
}

function Header({ onRefresh, onHistory, historyLabel }: { onRefresh: () => void; onHistory: () => void; historyLabel: string }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <p className="text-lg font-semibold">Centre de validation</p>
          <p className="text-sm text-muted-foreground">PP fait le rapprochement quand il est certain. Vous intervenez uniquement en cas de doute.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh}><RefreshCw className="mr-1.5 h-4 w-4" />Actualiser</Button>
          <Button size="sm" variant="ghost" onClick={onHistory}><History className="mr-1.5 h-4 w-4" />{historyLabel}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CountCard({ label, value, tone = "text-foreground" }: { label: string; value: number; tone?: string }) {
  return <Card><CardContent className="py-4"><p className="text-sm text-muted-foreground">{label}</p><p className={cn("text-3xl font-semibold", tone)}>{value}</p></CardContent></Card>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-base font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{subtitle}</p></div>;
}

function ActionRow({ action, onApply, onKeep, busy }: { action: ControlAction; onApply: () => void; onKeep?: () => void; busy: boolean }) {
  const isAutomatic = canAutoApply(action);
  return (
    <Card className={cn(isAutomatic && "border-emerald-200")}>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          {isAutomatic ? <Sparkles className="h-4 w-4 text-emerald-600" /> : <span className="text-sm font-semibold">?</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{action.title}</p>
          <p className="text-sm text-muted-foreground">{action.reason}</p>
          {action.amount != null && <p className="mt-1 text-sm font-medium">{formatEuro(action.amount)}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {isAutomatic ? (
            <Button size="sm" onClick={onApply} disabled={busy}>Rapprocher</Button>
          ) : action.operation.kind !== "none" ? (
            <Button size="sm" onClick={onApply} disabled={busy}>Valider</Button>
          ) : (
            <Button asChild size="sm" variant="secondary"><Link to={action.to as never} search={{} as never}>Ouvrir <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
          )}
          {onKeep && <Button size="sm" variant="outline" onClick={onKeep} disabled={busy}>Ne rien changer</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryRow({ action, onUndo, busy }: { action: ControlAction; onUndo: () => void; busy: boolean }) {
  return (
    <Card><CardContent className="flex flex-wrap items-center gap-3 py-3">
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{action.title}</p><p className="text-xs text-muted-foreground">{action.state === "corrigee_auto" ? "Fait automatiquement par PP" : "Décision enregistrée"}</p></div>
      {action.amount != null && <Badge variant="outline">{formatEuro(action.amount)}</Badge>}
      <Button size="sm" variant="outline" onClick={onUndo} disabled={busy}><Undo2 className="mr-1 h-3 w-3" />Annuler</Button>
    </CardContent></Card>
  );
}

function Empty({ text }: { text: string }) {
  return <Card className="border-dashed"><CardContent className="flex items-center gap-3 py-8"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="text-sm text-muted-foreground">{text}</p></CardContent></Card>;
}
