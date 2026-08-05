// Classement des clients par rentabilité horaire réelle : recherche, filtres,
// tri, regroupement et affichage progressif pour éviter une liste interminable.
// Aucune donnée n'est recalculée ici : on affiche uniquement les résultats du
// moteur analyzeTimeValue (heures réelles + CA normalisé).
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatEuro } from "@/lib/pilot";
import { formatHours } from "@/lib/format-utils";
import {
  CLIENT_ZONE_META,
  HOURS_BASIS_LABEL,
  sortClients,
  type ClientSort,
  type ClientTimeValue,
  type ClientZone,
} from "@/lib/pilot-time-value";

type Level = "green" | "yellow" | "orange" | "red" | "unknown";

const LEVEL_META: Record<Level, { label: string; icon: string; badge: string }> = {
  green: { label: "Excellente (≥ cible)", icon: "🟢", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  yellow: { label: "Correcte (70–100 % cible)", icon: "🟡", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  orange: { label: "Faible (0–70 % cible)", icon: "🟠", badge: "border-orange-200 bg-orange-50 text-orange-700" },
  red: { label: "Déficitaire (négative)", icon: "🔴", badge: "border-rose-200 bg-rose-50 text-rose-700" },
  unknown: { label: "Non calculable", icon: "⚪", badge: "border-slate-200 bg-slate-50 text-slate-500" },
};

function levelOf(rate: number | null, target: number): Level {
  if (rate == null || !Number.isFinite(rate)) return "unknown";
  if (rate < 0) return "red";
  if (rate >= target) return "green";
  if (rate >= target * 0.7) return "yellow";
  return "orange";
}

function euroPerHour(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)} €/h`;
}

type GroupBy = "none" | "zone" | "level";
const PAGE = 25;

export function ClientProfitabilityTable({
  rows,
  target,
}: {
  rows: ClientTimeValue[];
  target: number;
}) {
  const [q, setQ] = useState("");
  const [zoneFilter, setZoneFilter] = useState<ClientZone | "all">("all");
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");
  const [sort, setSort] = useState<ClientSort>("best_euro_h");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [visible, setVisible] = useState(PAGE);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let base = rows;
    if (needle) base = base.filter((c) => c.name.toLowerCase().includes(needle));
    if (zoneFilter !== "all") base = base.filter((c) => c.zone === zoneFilter);
    if (levelFilter !== "all") {
      base = base.filter((c) => levelOf(c.resultPerHour ?? c.caPerHour, target) === levelFilter);
    }
    return sortClients(base, sort);
  }, [rows, q, zoneFilter, levelFilter, sort, target]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: null as string | null, rows: filtered }];
    if (groupBy === "zone") {
      const order: ClientZone[] = ["strategique", "a_developper", "a_optimiser", "chronophage", "non_classe"];
      return order
        .map((z) => ({ key: z, label: CLIENT_ZONE_META[z].label, rows: filtered.filter((c) => c.zone === z) }))
        .filter((g) => g.rows.length > 0);
    }
    const order: Level[] = ["green", "yellow", "orange", "red", "unknown"];
    return order
      .map((l) => ({
        key: l,
        label: `${LEVEL_META[l].icon} ${LEVEL_META[l].label}`,
        rows: filtered.filter((c) => levelOf(c.resultPerHour ?? c.caPerHour, target) === l),
      }))
      .filter((g) => g.rows.length > 0);
  }, [filtered, groupBy, target]);

  // Affichage progressif appliqué sur l'ensemble des groupes (dans l'ordre).
  let remaining = visible;
  const shownGroups = groups.map((g) => {
    const take = Math.max(0, Math.min(g.rows.length, remaining));
    remaining -= take;
    return { ...g, shown: g.rows.slice(0, take) };
  });
  const totalShown = shownGroups.reduce((s, g) => s + g.shown.length, 0);
  const hasMore = totalShown < filtered.length;

  const resetPaging = () => setVisible(PAGE);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            resetPaging();
          }}
          placeholder="Rechercher un client…"
          className="w-48"
        />
        <Select
          value={zoneFilter}
          onValueChange={(v) => {
            setZoneFilter(v as ClientZone | "all");
            resetPaging();
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Zone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les zones</SelectItem>
            {(["strategique", "a_developper", "a_optimiser", "chronophage", "non_classe"] as ClientZone[]).map(
              (z) => (
                <SelectItem key={z} value={z}>
                  {CLIENT_ZONE_META[z].label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Select
          value={levelFilter}
          onValueChange={(v) => {
            setLevelFilter(v as Level | "all");
            resetPaging();
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Rentabilité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute rentabilité</SelectItem>
            {(["green", "yellow", "orange", "red", "unknown"] as Level[]).map((l) => (
              <SelectItem key={l} value={l}>
                {LEVEL_META[l].icon} {LEVEL_META[l].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as ClientSort)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="best_euro_h">Meilleur €/h</SelectItem>
            <SelectItem value="worst_euro_h">Pire €/h</SelectItem>
            <SelectItem value="ca">Plus gros CA</SelectItem>
            <SelectItem value="hours">Plus gros temps consommé</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={groupBy}
          onValueChange={(v) => {
            setGroupBy(v as GroupBy);
            resetPaging();
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sans regroupement</SelectItem>
            <SelectItem value="zone">Regrouper par zone</SelectItem>
            <SelectItem value="level">Regrouper par rentabilité</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} client(s) — {totalShown} affiché(s)
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucun client ne correspond aux filtres sélectionnés.
        </p>
      ) : (
        <div className="space-y-4">
          {shownGroups.map((g) =>
            g.shown.length === 0 ? null : (
              <div key={g.key} className="space-y-1">
                {g.label && (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {g.label} ({g.rows.length})
                  </p>
                )}
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pl-3 pr-3">Client</th>
                        <th className="py-2 pr-3 text-right">CA HT</th>
                        <th className="py-2 pr-3 text-right">Résultat brut</th>
                        <th className="py-2 pr-3 text-right">Temps passé</th>
                        <th className="py-2 pr-3 text-right">Interv.</th>
                        <th className="py-2 pr-3 text-right">€/h</th>
                        <th className="py-2 pr-3">Prestation principale</th>
                        <th className="py-2 pr-3">Zone</th>
                        <th className="py-2 pr-3 text-center">Niveau</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.shown.map((c) => {
                        const level = levelOf(c.resultPerHour ?? c.caPerHour, target);
                        return (
                          <tr key={c.clientId} className="border-b last:border-0">
                            <td className="py-2 pl-3 pr-3 font-medium">
                              <Link
                                to="/pilot/fiche/$clientId"
                                params={{ clientId: c.clientId }}
                                className="text-primary underline-offset-2 hover:underline"
                              >
                                {c.name}
                              </Link>
                            </td>
                            <td className="py-2 pr-3 text-right">{formatEuro(c.caHt)}</td>
                            <td
                              className={`py-2 pr-3 text-right ${
                                (c.resultatBrut ?? 0) < 0 ? "text-[var(--pp-charges,#d9534f)]" : ""
                              }`}
                            >
                              {c.resultatBrut == null ? "—" : formatEuro(c.resultatBrut)}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {c.hours > 0 ? formatHours(c.hours) : "—"}
                              {c.hoursBasis === "vendues" && (
                                <span
                                  className="ml-1 text-[10px] text-amber-600"
                                  title={HOURS_BASIS_LABEL.vendues}
                                >
                                  indic.
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right">{c.interventions || "—"}</td>
                            <td className="py-2 pr-3 text-right font-medium">
                              {euroPerHour(c.resultPerHour ?? c.caPerHour)}
                            </td>
                            <td className="py-2 pr-3 text-xs text-muted-foreground">
                              {c.mainPrestation ?? "—"}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge variant="outline" className={`text-[10px] ${CLIENT_ZONE_META[c.zone].badge}`}>
                                {CLIENT_ZONE_META[c.zone].label}
                              </Badge>
                            </td>
                            <td className="py-2 pr-3 text-center">
                              <Badge variant="outline" className={`text-[10px] ${LEVEL_META[level].badge}`}>
                                {LEVEL_META[level].icon}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
            Afficher plus ({filtered.length - totalShown} restant(s))
          </Button>
        </div>
      )}
    </div>
  );
}
