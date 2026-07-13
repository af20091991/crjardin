import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listGoals, createGoal, updateGoal, deleteGoal, computeGoalStats,
  THEMES, THEME_META, PRIORITY_META, STATUS_META,
  type Goal, type GoalInput, type GoalTheme, type GoalPriority, type GoalStatus,
} from "@/lib/pilot-goals";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, Target, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pilot/objectifs")({
  head: () => ({ meta: [{ title: "Objectifs stratégiques — Pilot Pro" }] }),
  component: GoalsPage,
});

type Draft = {
  id?: string;
  theme: GoalTheme;
  title: string;
  deadline: string;
  priority: GoalPriority;
  status: GoalStatus;
  completed_date: string;
  comment: string;
};

const emptyDraft = (theme: GoalTheme): Draft => ({
  theme,
  title: "",
  deadline: "",
  priority: "moyenne",
  status: "en_cours",
  completed_date: "",
  comment: "",
});

function GoalsPage() {
  const qc = useQueryClient();
  const goalsQ = useQuery({ queryKey: ["pilot-goals"], queryFn: listGoals });
  const goals = goalsQ.data ?? [];
  const stats = useMemo(() => computeGoalStats(goals), [goals]);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft("commercial"));
  const [toDelete, setToDelete] = useState<Goal | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pilot-goals"] });
  const onErr = (e: Error) => toast.error(e.message);

  const createMut = useMutation({
    mutationFn: createGoal,
    onSuccess: () => { invalidate(); toast.success("Objectif ajouté"); },
    onError: onErr,
  });
  const updateMut = useMutation({
    mutationFn: (p: { id: string; input: Partial<GoalInput> }) => updateGoal(p.id, p.input),
    onSuccess: invalidate,
    onError: onErr,
  });
  const deleteMut = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => { invalidate(); toast.success("Objectif supprimé"); },
    onError: onErr,
  });

  const openNew = (theme: GoalTheme) => { setDraft(emptyDraft(theme)); setOpen(true); };
  const openEdit = (g: Goal) => {
    setDraft({
      id: g.id, theme: g.theme, title: g.title, deadline: g.deadline ?? "",
      priority: g.priority, status: g.status, completed_date: g.completed_date ?? "",
      comment: g.comment ?? "",
    });
    setOpen(true);
  };

  const save = () => {
    if (!draft.title.trim()) { toast.error("Renseignez l'intitulé de l'objectif"); return; }
    const input: GoalInput = {
      theme: draft.theme,
      title: draft.title.trim(),
      deadline: draft.deadline.trim() || null,
      priority: draft.priority,
      status: draft.status,
      completed_date: draft.status === "termine" ? (draft.completed_date || null) : null,
      comment: draft.comment.trim() || null,
    };
    if (draft.id) {
      updateMut.mutate({ id: draft.id, input });
    } else {
      const pos = goals.filter((g) => g.theme === draft.theme).length + 1;
      createMut.mutate({ ...input, position: pos });
    }
    setOpen(false);
  };

  const cycleStatus = (g: Goal) => {
    const next: GoalStatus = g.status === "en_cours" ? "termine" : g.status === "termine" ? "abandonne" : "en_cours";
    updateMut.mutate({
      id: g.id,
      input: { status: next, completed_date: next === "termine" ? (g.completed_date ?? new Date().toISOString().slice(0, 10)) : null },
    });
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Target className="h-6 w-6 text-primary" /> Objectifs stratégiques
          </h1>
          <p className="text-sm text-muted-foreground">Pilotage de vos objectifs par thématique, en temps réel.</p>
        </div>
        <Button onClick={() => openNew("commercial")}>
          <Plus className="mr-1.5 h-4 w-4" /> Nouvel objectif
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile icon={<TrendingUp className="h-4 w-4" />} label="Taux d'avancement" value={`${stats.completionRate.toFixed(0)} %`}
          sub={`${stats.done}/${Math.max(stats.total - stats.abandoned, 0)} atteints`} accent>
          <Progress value={stats.completionRate} className="mt-2 h-1.5" />
        </KpiTile>
        <KpiTile icon={<Target className="h-4 w-4" />} label="Objectifs suivis" value={String(stats.total)}
          sub={`${THEMES.length} thématiques`} />
        <KpiTile icon={<Clock className="h-4 w-4" />} label="En cours" value={String(stats.inProgress)}
          sub={stats.abandoned > 0 ? `${stats.abandoned} abandonné(s)` : "Tous actifs"} />
        <KpiTile icon={<CheckCircle2 className="h-4 w-4" />} label="Terminés" value={String(stats.done)}
          sub={`${stats.byPriority.find((p) => p.priority === "haute")?.count ?? 0} priorité haute`} />
      </div>

      {/* Avancement par thématique */}
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.byTheme.map((t) => (
            <div key={t.theme} className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <span>{THEME_META[t.theme].icon}</span>
                <span className="truncate">{THEME_META[t.theme].short}</span>
              </div>
              <Progress value={t.rate} className="h-1.5" />
              <p className="text-xs text-muted-foreground">{t.done}/{t.total} · {t.rate.toFixed(0)} %</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cartes par thématique */}
      {goalsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="space-y-6">
          {THEMES.map((theme) => {
            const rows = goals.filter((g) => g.theme === theme).sort((a, b) => a.position - b.position);
            const meta = THEME_META[theme];
            return (
              <section key={theme}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <span>{meta.icon}</span> {meta.label}
                    <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => openNew(theme)}>
                    <Plus className="mr-1 h-4 w-4" /> Ajouter
                  </Button>
                </div>
                {rows.length === 0 ? (
                  <Card><CardContent className="p-4 text-sm text-muted-foreground">Aucun objectif dans cette thématique.</CardContent></Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {rows.map((g) => (
                      <GoalCard key={g.id} goal={g} accent={meta.color}
                        onToggle={() => cycleStatus(g)} onEdit={() => openEdit(g)} onDelete={() => setToDelete(g)} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Dialog ajout/édition */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Modifier l'objectif" : "Nouvel objectif"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Thématique</Label>
              <Select value={draft.theme} onValueChange={(v) => setDraft((d) => ({ ...d, theme: v as GoalTheme }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THEMES.map((t) => (
                    <SelectItem key={t} value={t}>{THEME_META[t].icon} {THEME_META[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Objectif</Label>
              <Textarea value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Ex : Augmenter le panier moyen de 500 à 700 €" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Échéance</Label>
                <Input value={draft.deadline} onChange={(e) => setDraft((d) => ({ ...d, deadline: e.target.value }))}
                  placeholder="2027, mi-2026, Mars 2027…" />
              </div>
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <Select value={draft.priority} onValueChange={(v) => setDraft((d) => ({ ...d, priority: v as GoalPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_META) as GoalPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft((d) => ({ ...d, status: v as GoalStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_META) as GoalStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_META[s].icon} {STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {draft.status === "termine" && (
                <div className="space-y-1.5">
                  <Label>Date de réalisation</Label>
                  <Input type="date" value={draft.completed_date}
                    onChange={(e) => setDraft((d) => ({ ...d, completed_date: e.target.value }))} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Commentaires</Label>
              <Textarea value={draft.comment} onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
                placeholder="Notes, détails, chiffrage…" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={createMut.isPending || updateMut.isPending}>
              {draft.id ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet objectif ?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete?.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toDelete) deleteMut.mutate(toDelete.id); setToDelete(null); }}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiTile({ icon, label, value, sub, accent, children }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean; children?: React.ReactNode;
}) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon} {label}
        </div>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        {children}
      </CardContent>
    </Card>
  );
}

function GoalCard({ goal, accent, onToggle, onEdit, onDelete }: {
  goal: Goal; accent: string; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const s = STATUS_META[goal.status];
  const p = PRIORITY_META[goal.priority];
  return (
    <Card className="group relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accent }} />
      <CardContent className="space-y-2 py-3 pl-4 pr-3">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium leading-snug ${goal.status === "abandonne" ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {goal.title}
          </p>
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={onToggle} title="Changer le statut"
            className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-transform hover:scale-105 ${s.tone}`}>
            {s.icon} {s.label}
          </button>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${p.tone}`}>{p.label}</span>
          {goal.deadline && (
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
              📅 {goal.deadline}
            </span>
          )}
          {goal.completed_date && (
            <span className="text-xs text-emerald-600">✓ {new Date(goal.completed_date).toLocaleDateString("fr-FR")}</span>
          )}
        </div>
        {goal.comment && <p className="text-xs italic text-muted-foreground">{goal.comment}</p>}
      </CardContent>
    </Card>
  );
}