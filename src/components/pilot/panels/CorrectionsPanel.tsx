// Parcours de correction assistée (Pilot Pro V2.3+ — Phase 7).
// Chaque correction est visible, expliquée, validée par l'utilisateur et historisée.
// Aucun rapprochement automatique, aucune fusion, aucune estimation d'heures.
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listClients } from "@/lib/clients";
import { listChargeCategories } from "@/lib/pilot-charges";
import {
  attachSstClient,
  buildActionPlan,
  CHARGE_TARGET_LABELS,
  classifyCharge,
  confirmSaleTime,
  euroFix,
  ignoreFixItem,
  listChargesToClassify,
  listIgnored,
  listSalesMissingTime,
  listSiteQualificationTargets,
  listSstMissingClient,
  restoreFixItem,
  SCOPE_LABELS,
  type ChargeTarget,
  type ChargeToClassify,
  type FixScope,
  type SaleMissingTime,
  type SstToAttach,
} from "@/lib/pilot-fix-flows";
import { ArrowRight, Check, MapPin, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";


const TARGETS: ChargeTarget[] = ["fixe", "variable", "investissement", "remuneration"];

function IgnoreButton({
  scope,
  table,
  targetId,
  label,
  onDone,
}: {
  scope: FixScope;
  table: string;
  targetId: string;
  label: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => ignoreFixItem({ scope, table, targetId, label, reason }),
    onSuccess: () => {
      toast.success("Ligne ignorée — justification enregistrée");
      setOpen(false);
      setReason("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Ignorer
      </Button>
    );
  return (
    <div className="flex items-center gap-2">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Justification obligatoire"
        className="h-8 w-52"
      />
      <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate()}>
        Confirmer
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Annuler
      </Button>
    </div>
  );
}

function IgnoredList({ scope }: { scope: FixScope }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["fix-ignored", scope], queryFn: () => listIgnored(scope) });
  const m = useMutation({
    mutationFn: (id: string) => restoreFixItem(id),
    onSuccess: () => {
      toast.success("Ligne réintégrée au parcours");
      qc.invalidateQueries({ queryKey: ["fix-ignored", scope] });
      qc.invalidateQueries({ queryKey: ["fix", scope] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = q.data ?? [];
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-dashed p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Ignorées avec justification ({rows.length})
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 text-xs">
            <span className="min-w-0">
              <span className="font-medium">{r.label}</span>
              <span className="text-muted-foreground"> — {r.reason}</span>
            </span>
            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => m.mutate(r.id)}>
              <Undo2 className="mr-1 h-3 w-3" /> Réintégrer
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Charges ────────────────────────────────────────────────────────────────
const OTHER_CATEGORY = "__autre__";

function ChargeRowCard({
  row,
  onDone,
  categories,
}: {
  row: ChargeToClassify;
  onDone: () => void;
  /** Catégories déjà paramétrées : évite les libellés saisis à la main. */
  categories: string[];
}) {
  const [target, setTarget] = useState<ChargeTarget>(row.suggestion?.target ?? "fixe");
  const initialCategory = row.suggestion?.category ?? row.currentCategory;
  const [category, setCategory] = useState(initialCategory);
  // Saisie libre uniquement si la catégorie n'existe pas déjà.
  const [freeText, setFreeText] = useState(
    Boolean(initialCategory) && !categories.includes(initialCategory),
  );
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: (override?: { target: ChargeTarget; category: string }) =>
      classifyCharge(row, override?.target ?? target, override?.category ?? category, note),
    onSuccess: () => {
      toast.success("Charge classée — modification historisée");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{row.designation}</p>
        <span className="text-sm font-semibold tabular-nums">{euroFix(row.amount)}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {String(row.month).padStart(2, "0")}/{row.year} · catégorie actuelle : {row.currentCategory || "aucune"} ·
        classe actuelle : à classer
      </p>
      {row.suggestion && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-primary">
          <span>
            Proposition : {CHARGE_TARGET_LABELS[row.suggestion.target]} / {row.suggestion.category} —{" "}
            {row.suggestion.why}
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="h-6 px-2"
            disabled={m.isPending}
            onClick={() =>
              m.mutate({
                target: row.suggestion!.target,
                category: row.suggestion!.category,
              })
            }
          >
            <Check className="mr-1 h-3 w-3" /> Accepter la proposition
          </Button>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select value={target} onValueChange={(v) => setTarget(v as ChargeTarget)}>
          <SelectTrigger className="h-8 w-[13rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGETS.map((t) => (
              <SelectItem key={t} value={t}>
                {CHARGE_TARGET_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {freeText ? (
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Nouvelle catégorie"
            className="h-8 w-44"
            autoFocus
          />
        ) : (
          <Select
            value={categories.includes(category) ? category : ""}
            onValueChange={(v) => {
              if (v === OTHER_CATEGORY) {
                setFreeText(true);
                setCategory("");
              } else setCategory(v);
            }}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_CATEGORY}>Autre catégorie…</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Motif (optionnel)"
          className="h-8 w-48"
        />
        <Button
          size="sm"
          disabled={m.isPending || !category.trim()}
          onClick={() => m.mutate(undefined)}
        >
          <Check className="mr-1 h-3 w-3" /> Classer
        </Button>
        <IgnoreButton
          scope="charges"
          table="pilot_ca_entries"
          targetId={row.id}
          label={`${row.designation} (${euroFix(row.amount)})`}
          onDone={onDone}
        />
      </div>
    </div>
  );
}

function ChargesFlow() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["fix", "charges"], queryFn: listChargesToClassify });
  // Catégories existantes : aucune création implicite, aucune donnée modifiée.
  const catsQ = useQuery({ queryKey: ["pilot-charge-categories"], queryFn: listChargeCategories });
  const categories = (catsQ.data ?? []).map((c) => c.label).filter(Boolean);
  const [limit, setLimit] = useState(25);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["fix", "charges"] });
    qc.invalidateQueries({ queryKey: ["fix-ignored", "charges"] });
    qc.invalidateQueries({ queryKey: ["fix-plan"] });
  };
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  const rows = q.data ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {rows.length} ligne(s) à classer, soit {euroFix(total)}. Chaque validation écrit la classe retenue et
        enregistre la trace (avant / après / motif). Aucun classement n'est appliqué automatiquement.
      </p>
      {rows.slice(0, limit).map((r) => (
        <ChargeRowCard key={r.id} row={r} onDone={refresh} categories={categories} />
      ))}
      {rows.length > limit && (
        <Button variant="outline" size="sm" onClick={() => setLimit(limit + 25)}>
          Afficher 25 lignes de plus
        </Button>
      )}
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Toutes les charges sont classées.</p>}
      <IgnoredList scope="charges" />
    </div>
  );
}

// ── Temps des lignes de vente (source unique) ──────────────────────────────
function HoursRowCard({ row, onDone }: { row: SaleMissingTime; onDone: () => void }) {
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => confirmSaleTime(row, Number(hours.replace(",", ".")), note),
    onSuccess: () => {
      toast.success("Temps enregistré dans le suivi CA");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{row.clientName}</p>
        {row.amount > 0 && <span className="text-sm tabular-nums">{euroFix(row.amount)}</span>}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {String(row.month).padStart(2, "0")}/{row.year} · {row.designation} ·{" "}
        {row.kind === "sst" ? "SST (0 h accepté)" : "Interne"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Temps (h)"
          className="h-8 w-36"
          inputMode="decimal"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Précision (optionnel)"
          className="h-8 w-48"
        />
        <Button size="sm" disabled={m.isPending || !hours} onClick={() => m.mutate()}>
          <Check className="mr-1 h-3 w-3" /> Valider
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/pilot/ca">Ouvrir le suivi CA</Link>
        </Button>
        <IgnoreButton
          scope="heures"
          table="pilot_ca_entries"
          targetId={row.id}
          label={`${row.clientName} — ${row.designation}`}
          onDone={onDone}
        />
      </div>
    </div>
  );
}

function HoursFlow() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["fix", "heures"], queryFn: listSalesMissingTime });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["fix", "heures"] });
    qc.invalidateQueries({ queryKey: ["fix-ignored", "heures"] });
    qc.invalidateQueries({ queryKey: ["fix-plan"] });
  };
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  const rows = q.data ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {rows.length} ligne(s) de vente sans temps. Le temps du suivi CA est la{" "}
        <strong>seule source</strong> utilisée par les calculs : aucune heure n'est reprise des comptes-rendus ni
        du module SST. Un temps de 0 h reste valide sur une ligne de type SST.
      </p>
      {rows.map((r) => (
        <HoursRowCard key={r.id} row={r} onDone={refresh} />
      ))}
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Toutes les lignes de vente ont un temps documenté.</p>
      )}
      <IgnoredList scope="heures" />
    </div>
  );
}

// ── SST ────────────────────────────────────────────────────────────────────
function SstRowCard({ row, onDone }: { row: SstToAttach; onDone: () => void }) {
  const clients = useQuery({ queryKey: ["clients-lite"], queryFn: listClients });
  const [clientId, setClientId] = useState("");
  const [note, setNote] = useState("");
  const label = useMemo(
    () => (clients.data ?? []).find((c) => c.id === clientId)?.name ?? "",
    [clients.data, clientId],
  );
  const m = useMutation({
    mutationFn: () => attachSstClient(row, clientId, label, note),
    onSuccess: () => {
      toast.success("Mission rattachée — modification historisée");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{row.mission}</p>
        <span className="text-sm tabular-nums">
          coût {euroFix(row.cost)}
          {row.clientPrice > 0 && ` · vendu ${euroFix(row.clientPrice)}`}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {row.subcontractor} · {row.date ? new Date(row.date).toLocaleDateString("fr-FR") : "période inconnue"} ·
        client manquant
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="h-8 w-[16rem]">
            <SelectValue placeholder="Choisir le client" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {(clients.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Motif (optionnel)"
          className="h-8 w-48"
        />
        <Button size="sm" disabled={m.isPending || !clientId} onClick={() => m.mutate()}>
          <Check className="mr-1 h-3 w-3" /> Rattacher
        </Button>
        <IgnoreButton
          scope="sst"
          table="subcontractor_missions"
          targetId={row.id}
          label={`${row.subcontractor} — ${row.mission}`}
          onDone={onDone}
        />
      </div>
    </div>
  );
}

function SstFlow() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["fix", "sst"], queryFn: listSstMissingClient });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["fix", "sst"] });
    qc.invalidateQueries({ queryKey: ["fix-ignored", "sst"] });
    qc.invalidateQueries({ queryKey: ["fix-plan"] });
  };
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  const rows = q.data ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {rows.length} mission(s) sans client. Le rattachement est strictement manuel : aucune correspondance
        n'est déduite automatiquement.
      </p>
      {rows.map((r) => (
        <SstRowCard key={r.id} row={r} onDone={refresh} />
      ))}
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Toutes les missions sont rattachées à un client.</p>
      )}
      <IgnoredList scope="sst" />
    </div>
  );
}

// ── Sites ──────────────────────────────────────────────────────────────────
function SitesFlow() {
  const q = useQuery({ queryKey: ["fix", "sites"], queryFn: () => listSiteQualificationTargets(40) });
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  const rows = q.data ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Liste priorisée par chiffre d'affaires concerné, volume d'interventions puis ancienneté. Aucun Site
        n'est créé et aucune donnée n'est rattachée ici : la validation se fait dans le centre Sites existant.
      </p>
      {rows.map((t) => (
        <div key={t.clientId} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">{t.clientName}</p>
            <span className="text-sm font-semibold tabular-nums">{euroFix(t.caAmount)}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.caLines} ligne(s) de CA sans Site · {t.interventions} intervention(s) sans Site · depuis{" "}
            {t.oldestYear ?? "—"}
          </p>
          {t.labels.length > 0 && (
            <p className="mt-1 text-xs">
              <span className="text-muted-foreground">Appellations détectées : </span>
              {t.labels.join(" · ")}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                t.confidence === "forte"
                  ? "text-primary"
                  : t.confidence === "moyenne"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-destructive"
              }
            >
              Confiance {t.confidence}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t.proposedSite ? `Site proposé : ${t.proposedSite.name}` : "Aucun Site proposé"} —{" "}
              {t.confidenceWhy}
            </span>
            <Button asChild size="sm" variant="outline" className="ml-auto">
              <Link to="/pilot/sites">
                Centre Sites <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Tout le chiffre d'affaires rattachable l'est déjà.</p>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export function CorrectionsPage() {
  const qc = useQueryClient();
  const plan = useQuery({ queryKey: ["fix-plan"], queryFn: buildActionPlan });
  const [tab, setTab] = useState<FixScope>("charges");

  return (
    <div className="space-y-6 py-4">
      <header>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Corrections assistées</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque anomalie détectée dans le centre Qualité devient ici une correction guidée : le problème est
          expliqué, la proposition est visible, vous validez, et la modification est historisée.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Plan d'action
            <Button asChild size="sm" variant="ghost" className="ml-auto">
              <Link to="/pilot/qualite">Centre Qualité</Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {plan.isLoading && <Skeleton className="h-24 w-full" />}
          {(plan.data ?? []).map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setTab(a.key)}
              className="rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            >
              <p className="text-sm font-medium">
                {a.dot} {a.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{a.impact}</p>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={a.progress} className="h-1.5" />
                <span className="shrink-0 text-xs tabular-nums">{a.progress} %</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{a.volume}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as FixScope)}>
        <TabsList className="flex-wrap">
          {(["charges", "heures", "sst", "sites"] as FixScope[]).map((s) => (
            <TabsTrigger key={s} value={s}>
              {SCOPE_LABELS[s]}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["fix"] });
              qc.invalidateQueries({ queryKey: ["fix-plan"] });
            }}
          >
            <RotateCcw className="mr-1 h-3 w-3" /> Actualiser
          </Button>
        </div>
        <TabsContent value="charges" className="mt-2">
          <ChargesFlow />
        </TabsContent>
        <TabsContent value="heures" className="mt-2">
          <HoursFlow />
        </TabsContent>
        <TabsContent value="sst" className="mt-2">
          <SstFlow />
        </TabsContent>
        <TabsContent value="sites" className="mt-2">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Préparation uniquement — les analyses restent basées sur le
            Client.
          </div>
          <SitesFlow />
        </TabsContent>
      </Tabs>
    </div>
  );
}
