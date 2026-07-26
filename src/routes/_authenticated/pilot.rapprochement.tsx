import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Link2, Sparkles, Search, X, Undo2, UserPlus, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { listClients } from "@/lib/clients";
import { CATEGORY_LABELS, MONTH_NAMES, type CaEntry } from "@/lib/pilot-ca";
import { CA_CODES, parseDesignation } from "@/lib/pilot-ca-designation";
import { formatEuro } from "@/lib/pilot";
import { ClientForm } from "@/components/ClientForm";
import {
  buildDesignationIndex,
  autoLinkHighConfidence,
  createClientFromEntry,
  CONFIDENCE_META,
  type ConfidenceLevel,
  linkEntryToClient,
  listLinkedEntries,
  listOrphanEntries,
  listRecentDecisions,
  revertLastDecision,
  suggestClients,
  type Suggestion,
} from "@/lib/pilot-ca-matching";

export const Route = createFileRoute("/_authenticated/pilot/rapprochement")({
  head: () => ({ meta: [{ title: "Rapprochement CA — Pilot Pro" }] }),
  component: RapprochementPage,
});

function RapprochementPage() {
  const qc = useQueryClient();
  const orphans = useQuery({ queryKey: ["pilot-ca-orphans"], queryFn: listOrphanEntries });
  const linked = useQuery({ queryKey: ["pilot-ca-linked-desig"], queryFn: listLinkedEntries });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const decisions = useQuery({ queryKey: ["pilot-ca-decisions"], queryFn: () => listRecentDecisions(20) });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [confFilter, setConfFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [manualClientId, setManualClientId] = useState<string>("");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["pilot-ca-orphans"] });
    qc.invalidateQueries({ queryKey: ["pilot-ca-linked-desig"] });
    qc.invalidateQueries({ queryKey: ["pilot-ca-decisions"] });
    qc.invalidateQueries({ queryKey: ["pilot-ca-entries"] });
    qc.invalidateQueries({ queryKey: ["client-scores"] });
  };

  const designationIndex = useMemo(
    () => buildDesignationIndex(linked.data ?? []),
    [linked.data],
  );

  const years = useMemo(() => {
    const set = new Set<number>();
    (orphans.data ?? []).forEach((e) => set.add(e.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [orphans.data]);

  /** Évaluation (suggestions + confiance) de chaque ligne orpheline. */
  const evalByEntry = useMemo(() => {
    const map = new Map<string, Suggestion[]>();
    const list = orphans.data ?? [];
    const cl = clients.data ?? [];
    if (cl.length === 0) return map;
    for (const e of list) map.set(e.id, suggestClients(e, cl, designationIndex, { limit: 5 }));
    return map;
  }, [orphans.data, clients.data, designationIndex]);

  const confidenceOf = (id: string): ConfidenceLevel =>
    evalByEntry.get(id)?.[0]?.confidence ?? "faible";

  const autoReady = useMemo(
    () =>
      (orphans.data ?? [])
        .map((entry) => ({ entry, suggestion: evalByEntry.get(entry.id)?.[0] }))
        .filter((r): r is { entry: CaEntry; suggestion: Suggestion } =>
          !!r.suggestion && r.suggestion.confidence === "haute",
        ),
    [orphans.data, evalByEntry],
  );

  const filtered = useMemo(() => {
    const list = orphans.data ?? [];
    const term = q.trim().toLowerCase();
    return list.filter((e) => {
      if (yearFilter !== "all" && String(e.year) !== yearFilter) return false;
      if (confFilter !== "all" && confidenceOf(e.id) !== confFilter) return false;
      if (term && !(e.designation ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [orphans.data, yearFilter, q, confFilter, evalByEntry]);

  const selected = useMemo(
    () => (orphans.data ?? []).find((e) => e.id === selectedId) ?? null,
    [orphans.data, selectedId],
  );

  const suggestions: Suggestion[] = useMemo(() => {
    if (!selected) return [];
    return evalByEntry.get(selected.id) ?? [];
  }, [selected, evalByEntry]);

  const linkMut = useMutation({
    mutationFn: (p: { entryId: string; clientId: string | null; method: Parameters<typeof linkEntryToClient>[0]["method"]; score?: number | null }) =>
      linkEntryToClient(p),
    onSuccess: (_data, vars) => {
      toast.success(vars.clientId ? "Ligne rattachée" : "Décision enregistrée");
      setSelectedId(null);
      setManualClientId("");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revertMut = useMutation({
    mutationFn: (entryId: string) => revertLastDecision(entryId),
    onSuccess: () => {
      toast.success("Décision annulée");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoMut = useMutation({
    mutationFn: () => autoLinkHighConfidence(autoReady),
    onSuccess: (n) => {
      toast.success(`${n} ligne(s) rattachée(s) automatiquement`);
      setSelectedId(null);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: (entry: CaEntry) => createClientFromEntry(entry),
    onSuccess: () => {
      toast.success("Fiche client créée et ligne rattachée");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["clients"] });
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orphanCount = (orphans.data ?? []).length;
  const clientById = useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c])),
    [clients.data],
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Link2 className="h-6 w-6 text-primary" /> Rapprochement CA ↔ Clients
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Rattachez les lignes de chiffre d'affaires historiques à leur client CRM. Aucun montant,
            aucune date, aucune catégorie n'est modifié — seule l'affectation client est complétée,
            et chaque décision est journalisée.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-sm">
            <AlertTriangle className="h-3.5 w-3.5" />
            {orphans.isLoading ? "…" : `${orphanCount} ligne${orphanCount > 1 ? "s" : ""} sans client`}
          </Badge>
          <Button
            size="sm"
            disabled={autoReady.length === 0 || autoMut.isPending}
            onClick={() => autoMut.mutate()}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {autoMut.isPending
              ? "Rapprochement…"
              : `Rapprocher automatiquement (${autoReady.length})`}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Colonne gauche — liste orphelines */}
        <Card className="flex min-h-[500px] flex-col">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher une désignation…"
                  className="pl-9"
                />
              </div>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes années</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={confFilter} onValueChange={setConfFilter}>
                <SelectTrigger className="w-[165px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes confiances</SelectItem>
                  <SelectItem value="haute">Confiance haute</SelectItem>
                  <SelectItem value="moyenne">Confiance moyenne</SelectItem>
                  <SelectItem value="faible">Aucune suggestion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Le rattachement automatique n'est autorisé qu'en confiance haute
              (correspondance exacte ou désignation déjà validée). Une orthographe
              proche reste une simple suggestion.
            </p>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-[520px]">
              {orphans.isLoading ? (
                <div className="space-y-2 p-4">
                  {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-primary/60" />
                  {orphanCount === 0 ? "Toutes les lignes sont rattachées." : "Aucune ligne ne correspond aux filtres."}
                </div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((e) => (
                    <OrphanRow
                      key={e.id}
                      entry={e}
                      confidence={confidenceOf(e.id)}
                      selected={e.id === selectedId}
                      onSelect={() => setSelectedId(e.id)}
                    />
                  ))}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Colonne droite — panneau décision */}
        <Card className="min-h-[500px]">
          {!selected ? (
            <CardContent className="grid h-full min-h-[500px] place-items-center p-10 text-center text-sm text-muted-foreground">
              Sélectionnez une ligne à gauche pour voir les suggestions.
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> Décision
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Détails lecture seule */}
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="font-medium">{selected.designation || "(sans désignation)"}</div>
                  {(() => {
                    const p = parseDesignation(selected.designation);
                    if (p.codes.length === 0) return null;
                    return (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">Lecture métier :</span>
                        <Badge variant="outline" className="text-[10px]">Client : {p.name}</Badge>
                        {p.codes.map((c) => (
                          <Badge key={c} variant="outline" className="text-[10px]">
                            {c} — {CA_CODES[c].label}
                          </Badge>
                        ))}
                        {p.isPro && <Badge variant="outline" className="text-[10px]">Professionnel / résidence</Badge>}
                      </div>
                    );
                  })()}
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{MONTH_NAMES[selected.month - 1]} {selected.year}</span>
                    <span>{formatEuro(selected.amount_ht)} HT</span>
                    {selected.hours ? <span>{selected.hours} h</span> : null}
                    {selected.category ? <span>Cat. {CATEGORY_LABELS[selected.category]}</span> : null}
                  </div>
                  {selected.note ? (
                    <div className="mt-2 text-xs italic text-muted-foreground">« {selected.note} »</div>
                  ) : null}
                </div>

                {/* Suggestions */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Suggestions
                  </Label>
                  {suggestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucune correspondance trouvée. Utilisez la recherche manuelle ou créez un client.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {suggestions.map((s) => (
                        <li
                          key={s.client.id}
                          className="flex items-center gap-2 rounded-md border p-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {s.client.civility ? `${s.client.civility} ` : ""}{s.client.name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <Badge variant="outline" className="text-[10px]">
                                {s.reason === "historique"
                                  ? "Historique validé"
                                  : s.reason === "exact"
                                    ? "Exact"
                                    : s.reason === "renforce"
                                      ? "Nom + données"
                                      : "Similarité"}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] ${CONFIDENCE_META[s.confidence].badge}`}>
                                {CONFIDENCE_META[s.confidence].label}
                              </Badge>
                              <span>Score {(s.score * 100).toFixed(0)}%</span>
                            </div>
                            {s.evidence.length > 0 ? (
                              <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                                {s.evidence.map((ev) => <li key={ev}>· {ev}</li>)}
                              </ul>
                            ) : null}
                          </div>
                          <Button
                            size="sm"
                            disabled={linkMut.isPending}
                            onClick={() =>
                              linkMut.mutate({
                                entryId: selected.id,
                                clientId: s.client.id,
                                method: "suggestion",
                                score: s.score,
                              })
                            }
                          >
                            Associer
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Recherche manuelle */}
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Recherche manuelle
                  </Label>
                  <div className="flex gap-2">
                    <Select value={manualClientId} onValueChange={setManualClientId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choisir un client…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(clients.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.civility ? `${c.civility} ` : ""}{c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="secondary"
                      disabled={!manualClientId || linkMut.isPending}
                      onClick={() =>
                        linkMut.mutate({
                          entryId: selected.id,
                          clientId: manualClientId,
                          method: "manual",
                        })
                      }
                    >
                      Associer
                    </Button>
                  </div>
                </div>

                {/* Actions secondaires */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <ClientForm
                    trigger={
                      <Button variant="outline" size="sm">
                        <UserPlus className="mr-1.5 h-4 w-4" /> Nouveau client
                      </Button>
                    }
                    onSaved={(c) => {
                      linkMut.mutate({
                        entryId: selected.id,
                        clientId: c.id,
                        method: "new_client",
                      });
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={createMut.isPending || !selected.designation}
                    onClick={() => createMut.mutate(selected)}
                  >
                    <UserPlus className="mr-1.5 h-4 w-4" /> Fiche minimale depuis la désignation
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={linkMut.isPending}
                    onClick={() =>
                      linkMut.mutate({
                        entryId: selected.id,
                        clientId: null,
                        method: "refused",
                      })
                    }
                  >
                    <X className="mr-1.5 h-4 w-4" /> Ignorer
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* Journal des décisions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Décisions récentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(decisions.data ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucune décision enregistrée pour le moment.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(decisions.data ?? []).map((d) => {
                const target = d.new_client_id ? clientById.get(d.new_client_id) : null;
                const previous = d.previous_client_id ? clientById.get(d.previous_client_id) : null;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase">{d.method}</Badge>
                        <span className="truncate">
                          {d.method === "refused"
                            ? "Ligne ignorée"
                            : target
                              ? `→ ${target.name}`
                              : "→ (aucun client)"}
                          {previous ? ` · précédent : ${previous.name}` : ""}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(d.decided_at).toLocaleString("fr-FR")}
                        {d.score != null ? ` · score ${(d.score * 100).toFixed(0)}%` : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={revertMut.isPending}
                      onClick={() => revertMut.mutate(d.entry_id)}
                    >
                      <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Annuler
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrphanRow({
  entry, selected, onSelect, confidence,
}: { entry: CaEntry; selected: boolean; onSelect: () => void; confidence: ConfidenceLevel }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
          selected ? "bg-accent/40" : "hover:bg-muted/40"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {entry.designation || "(sans désignation)"}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{MONTH_NAMES[entry.month - 1]} {entry.year}</span>
            {entry.category ? <span>{CATEGORY_LABELS[entry.category]}</span> : null}
            <Badge variant="outline" className={`text-[10px] ${CONFIDENCE_META[confidence].badge}`}>
              {confidence === "faible" ? "Aucune suggestion" : CONFIDENCE_META[confidence].label}
            </Badge>
          </div>
        </div>
        <div className="whitespace-nowrap text-sm font-medium">{formatEuro(entry.amount_ht)}</div>
      </button>
    </li>
  );
}