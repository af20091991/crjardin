import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, MessageSquare, Wrench } from "lucide-react";
import { ChantierCharts } from "@/components/pilot/rentabilite/ChantierCharts";
import { CATEGORY_LABELS, listCaEntries } from "@/lib/pilot-ca";
import { listClients } from "@/lib/clients";
import { currentYear } from "@/lib/date-utils";
import { formatEuro } from "@/lib/pilot";
import {
  buildChantierRows,
  STATUT_LIBELLE,
  type ChantierRow,
  type RapprochementStatut,
} from "@/lib/rentabilite-chantier";

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

type SortKey = "client" | "ca" | "marge" | "taux" | "statut";

const SORT_LABELS: Record<SortKey, string> = {
  client: "Client",
  ca: "CA HT",
  marge: "Marge",
  taux: "Taux horaire",
  statut: "Statut",
};

const fmtH = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("fr-FR")} h`);

/** Rentabilité par chantier : filtres, recherche, tri, regroupement mensuel. */
export function ChantierProfitabilityView() {
  const year = currentYear();
  const caQ = useQuery({ queryKey: ["ca-entries", year], queryFn: () => listCaEntries(year) });
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<RapprochementStatut | "tous">("tous");
  const [clientId, setClientId] = useState("tous");
  const [sortKey, setSortKey] = useState<SortKey>("client");
  const [sortDesc, setSortDesc] = useState(false);
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => buildChantierRows(caQ.data ?? [], year), [caQ.data, year]);
  const names = useMemo(
    () => new Map((clientsQ.data ?? []).map((c) => [c.id, c.name])),
    [clientsQ.data],
  );
  const nameOf = (id: string) => names.get(id) ?? "Client inconnu";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (statut !== "tous" && r.statut !== statut) return false;
      if (clientId !== "tous" && r.client_id !== clientId) return false;
      if (q && !nameOf(r.client_id).toLowerCase().includes(q)) return false;
      return true;
    });
    const value = (r: ChantierRow): string | number => {
      switch (sortKey) {
        case "client":
          return nameOf(r.client_id).toLocaleLowerCase("fr");
        case "ca":
          return r.ca_ht;
        case "marge":
          return r.marge_ht;
        case "taux":
          return r.taux_horaire ?? -Infinity;
        case "statut":
          return STATUT_LIBELLE[r.statut];
      }
    };
    list.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "fr");
      return sortDesc ? -cmp : cmp;
    });
    return list;
    // nameOf dépend de names ; names est stable pour un même jeu de clients.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, statut, clientId, sortKey, sortDesc, names]);

  // Regroupement par mois, dans l'ordre de l'année (janvier en premier).
  const byMonth = useMemo(() => {
    const map = new Map<number, ChantierRow[]>();
    for (const r of filtered) {
      const list = map.get(r.month) ?? [];
      list.push(r);
      map.set(r.month, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const clientOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.client_id))].sort((a, b) =>
        nameOf(a).localeCompare(nameOf(b), "fr"),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, names],
  );
  const aRapprocher = rows.filter((r) => r.statut !== "complet").length;
  const prestationLabel = (r: ChantierRow) =>
    r.prestations
      .map((p) =>
        [p.category ? CATEGORY_LABELS[p.category] : null, p.designation]
          .filter(Boolean)
          .join(" · "),
      )
      .join(", ");

  if (caQ.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-4 w-4 text-primary" />
          Rentabilité chantier {year}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChantierCharts rows={rows} nameOf={nameOf} />
        <div className="grid gap-2 md:grid-cols-4">
          <Input
            placeholder="Rechercher un client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un client"
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            aria-label="Filtrer par client"
          >
            <option value="tous">Tous les clients</option>
            {clientOptions.map((id) => (
              <option key={id} value={id}>
                {nameOf(id)}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={statut}
            onChange={(e) => setStatut(e.target.value as RapprochementStatut | "tous")}
            aria-label="Filtrer par statut"
          >
            <option value="tous">Tous les statuts</option>
            {(Object.keys(STATUT_LIBELLE) as RapprochementStatut[]).map((s) => (
              <option key={s} value={s}>
                {STATUT_LIBELLE[s]}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Trier par"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  Trier : {SORT_LABELS[k]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortDesc((d) => !d)}
              className="h-9 rounded-md border border-input px-3 text-sm"
              aria-label="Inverser le tri"
            >
              {sortDesc ? "↓" : "↑"}
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length} chantier{filtered.length > 1 ? "s" : ""} affiché
          {filtered.length > 1 ? "s" : ""} sur {rows.length}
          {aRapprocher > 0 ? ` · ${aRapprocher} à rapprocher à la main` : ""}
        </p>

        {byMonth.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun chantier ne correspond aux filtres.
          </p>
        ) : (
          byMonth.map(([month, list]) => {
            const ca = list.reduce((s, r) => s + r.ca_ht, 0);
            const marge = list.reduce((s, r) => s + r.marge_ht, 0);
            return (
              <details key={month} open className="group rounded-lg border">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-1.5 text-base font-bold">
                    {MONTHS[month - 1]}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({list.length})
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    CA {formatEuro(ca)} · Marge {formatEuro(marge)}
                  </span>
                </summary>
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Client</th>
                        <th className="px-3 py-2 font-medium">Prestation</th>
                        <th className="px-3 py-2 text-right font-medium">CA HT</th>
                        <th className="px-3 py-2 text-right font-medium">Charges</th>
                        <th className="px-3 py-2 text-right font-medium">Marge</th>
                        <th className="px-3 py-2 text-right font-medium">Temps vente</th>
                        <th className="px-3 py-2 text-right font-medium">Taux horaire</th>
                        <th className="px-3 py-2 font-medium">Statut</th>
                        <th className="px-3 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => {
                        const open = !!openNotes[r.key];
                        return (
                          <Fragment key={r.key}>
                            <tr className="border-t">
                              <td className="px-3 py-2">{nameOf(r.client_id)}</td>
                              <td className="px-3 py-2 text-xs">{prestationLabel(r) || "—"}</td>
                              <td className="px-3 py-2 text-right">{formatEuro(r.ca_ht)}</td>
                              <td className="px-3 py-2 text-right">{formatEuro(r.charge_ht)}</td>
                              <td className="px-3 py-2 text-right font-semibold">
                                {formatEuro(r.marge_ht)}
                              </td>
                              <td className="px-3 py-2 text-right">{fmtH(r.temps_vente)}</td>
                              <td className="px-3 py-2 text-right">
                                {r.taux_horaire == null ? "—" : formatEuro(r.taux_horaire)}
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant={r.statut === "complet" ? "secondary" : "outline"}>
                                  {STATUT_LIBELLE[r.statut]}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
                                {r.notes.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenNotes((o) => ({ ...o, [r.key]: !o[r.key] }))
                                    }
                                    className="inline-flex items-center gap-1 text-xs text-primary"
                                    title="Voir le commentaire"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    {open ? "Masquer" : `Commentaire (${r.notes.length})`}
                                  </button>
                                )}
                              </td>
                            </tr>
                            {open && (
                              <tr className="bg-muted/30">
                                <td colSpan={9} className="px-3 py-2 text-xs">
                                  <ul className="space-y-1">
                                    {r.notes.map((n, i) => (
                                      <li key={i}>
                                        <span className="font-medium">
                                          {n.source === "vente" ? "Vente" : "Charge"}
                                          {n.designation ? ` (${n.designation})` : ""} :
                                        </span>{" "}
                                        {n.text}
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
