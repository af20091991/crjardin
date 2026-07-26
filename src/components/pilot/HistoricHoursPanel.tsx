import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/ClientForm";
import { listClients } from "@/lib/clients";
import { CONFIDENCE_META } from "@/lib/pilot-ca-matching";
import {
  listHistoricHours,
  suggestClientsForHours,
  assignHistoricHours,
  HISTORIC_STATUS_META,
  HOURS_SOURCE_META,
  type HistoricHoursRow,
} from "@/lib/pilot-historic-hours";
import { formatEuro } from "@/lib/pilot";
import { toast } from "sonner";
import { Clock, UserPlus, Check, X } from "lucide-react";

export function HistoricHoursPanel() {
  const qc = useQueryClient();
  const rows = useQuery({ queryKey: ["pilot-historic-hours"], queryFn: listHistoricHours });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const clientById = useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c])),
    [clients.data],
  );

  const assign = useMutation({
    mutationFn: assignHistoricHours,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pilot-historic-hours"] });
      setSelectedId(null);
      toast.success("Heures historiques mises à jour");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const all = rows.data ?? [];
  const pending = all.filter((r) => r.status === "a_valider");
  const linked = all.filter((r) => r.status === "valide");
  const selected = all.find((r) => r.id === selectedId) ?? null;
  const suggestions = selected
    ? suggestClientsForHours(selected, clients.data ?? [])
    : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <CardTitle className="text-base">Heures historiques importées (Excel)</CardTitle>
          <Badge variant="outline" className={`text-[10px] ${HOURS_SOURCE_META.historiques.badge}`}>
            {HOURS_SOURCE_META.historiques.origin}
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">
            {linked.length} rattachée{linked.length > 1 ? "s" : ""} · {pending.length} à valider
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Ces heures proviennent des tableaux Excel (2023-2025). Elles ne sont jamais confondues avec
          les heures vendues (CA) ni avec les heures réelles d'intervention, et aucun rattachement
          n'est forcé sans validation.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <ul className="max-h-[420px] divide-y overflow-auto rounded-md border">
          {all.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">Aucune heure historique importée.</li>
          ) : (
            all.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                    selectedId === r.id ? "bg-accent/40" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.raw_client_text}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{r.year}</span>
                      <span>{Number(r.hours).toFixed(2)} h</span>
                      {r.amount_ht != null && <span>{formatEuro(Number(r.amount_ht))}</span>}
                      <Badge variant="outline" className={`text-[10px] ${HISTORIC_STATUS_META[r.status].badge}`}>
                        {HISTORIC_STATUS_META[r.status].label}
                      </Badge>
                      {r.client_id && (
                        <span>→ {clientById.get(r.client_id)?.name ?? "client supprimé"}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-[10px] ${CONFIDENCE_META[r.confidence].badge}`}>
                    {CONFIDENCE_META[r.confidence].label}
                  </Badge>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="rounded-md border p-3">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Sélectionnez une ligne pour la rattacher à une fiche client.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium">{selected.raw_client_text}</div>
                <div className="text-xs text-muted-foreground">
                  {selected.year} · {Number(selected.hours).toFixed(2)} h
                  {selected.source_sheet ? ` · onglet ${selected.source_sheet}` : ""}
                  {selected.source_row ? ` · ligne ${selected.source_row}` : ""}
                </div>
                {selected.note && (
                  <p className="mt-1 text-xs text-muted-foreground">{selected.note}</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Suggestions</p>
                {suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune suggestion fiable — créez une fiche ou laissez non attribuée.
                  </p>
                ) : (
                  suggestions.map((s) => (
                    <div key={s.client.id} className="rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{s.client.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${CONFIDENCE_META[s.confidence].badge}`}>
                          {CONFIDENCE_META[s.confidence].label} · {(s.score * 100).toFixed(0)}%
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto"
                          disabled={assign.isPending}
                          onClick={() =>
                            assign.mutate({
                              id: selected.id,
                              clientId: s.client.id,
                              status: "valide",
                              confidence: s.confidence,
                              method: "suggestion",
                              note: `Heures historiques importées Excel — validé manuellement (${s.evidence.join(" ; ")}).`,
                            })
                          }
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" /> Rattacher
                        </Button>
                      </div>
                      <ul className="mt-1 list-inside list-disc text-[11px] text-muted-foreground">
                        {s.evidence.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <ClientForm
                  initial={{ name: selected.raw_client_text.replace(/\b(x\d|20\d\d)\b/gi, "").trim() }}
                  trigger={
                    <Button variant="outline" size="sm">
                      <UserPlus className="mr-1.5 h-4 w-4" /> Nouveau client
                    </Button>
                  }
                  onSaved={(c) =>
                    assign.mutate({
                      id: selected.id,
                      clientId: c.id,
                      status: "valide",
                      confidence: "haute",
                      method: "new_client",
                      note: "Heures historiques importées Excel — fiche client créée depuis le libellé.",
                    })
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={assign.isPending}
                  onClick={() =>
                    assign.mutate({
                      id: selected.id,
                      clientId: null,
                      status: "non_attribue",
                      confidence: "faible",
                      method: "refused",
                      note: "Heures historiques importées Excel — conservées sans rattachement client.",
                    })
                  }
                >
                  <X className="mr-1.5 h-4 w-4" /> Laisser non attribuée
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}