import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { AddStockMovementDialog } from "@/components/pilot/stock/AddStockMovementDialog";
import { BulkAddStockItemsDialog } from "@/components/pilot/stock/BulkAddStockItemsDialog";
import { EditStockItemDialog } from "@/components/pilot/stock/EditStockItemDialog";
import { EmptyState } from "@/components/pilot/EmptyState";
import { formatEuro } from "@/lib/pilot";
import { PP_COLORS } from "@/lib/pilot-colors";
import { toCsv, downloadCsv } from "@/lib/csv";
import { usePilotYear } from "@/lib/pilot-mode";
import { useIsAdmin } from "@/hooks/use-admin";
import {
  listStockItems,
  listStockMovements,
  listImportSnapshots,
  importSnapshotsYearlyValue,
  STOCK_MOVEMENT_TYPE_LABELS,
  type StockItem,
  type StockMovementType,
} from "@/lib/pilot-stock";
import {
  Leaf,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings2,
  Pencil,
  ChevronDown,
  Download,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/stock")({
  head: () => ({
    meta: [
      { title: "Stock — Pilot Pro" },
      {
        name: "description",
        content: "Inventaire, mouvements en temps réel et historique du stock.",
      },
    ],
  }),
  component: StockPage,
});

const MOVEMENT_BADGE_VARIANT: Record<StockMovementType, "default" | "destructive" | "secondary"> = {
  entree: "default",
  sortie: "destructive",
  ajustement: "secondary",
  perte: "destructive",
};

const MOVEMENT_ICON: Record<StockMovementType, typeof ArrowDownCircle> = {
  entree: ArrowDownCircle,
  sortie: ArrowUpCircle,
  ajustement: Settings2,
  perte: AlertTriangle,
};

function StockPage() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { year: selectedYear } = usePilotYear();
  const liveYear = new Date().getFullYear();
  const isLive = selectedYear >= liveYear;
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate({ to: "/pilot/direction", replace: true });
  }, [isAdmin, adminLoading, navigate]);

  const itemsQuery = useQuery({
    queryKey: ["pilot-stock", "items"],
    queryFn: listStockItems,
    enabled: isAdmin,
  });
  const movementsQuery = useQuery({
    queryKey: ["pilot-stock", "movements"],
    queryFn: () => listStockMovements(50),
    enabled: isAdmin,
  });
  const snapshotsQuery = useQuery({
    queryKey: ["pilot-stock", "import-snapshots"],
    queryFn: listImportSnapshots,
    enabled: isAdmin,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["pilot-stock"] });
  }

  if (adminLoading || !isAdmin) return <Skeleton className="h-96 w-full" />;

  if (itemsQuery.isLoading || movementsQuery.isLoading || snapshotsQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const items = itemsQuery.data ?? [];
  const movements = (movementsQuery.data ?? []).filter(
    (mv) => new Date(mv.occurred_at).getFullYear() === selectedYear,
  );
  const snapshots = snapshotsQuery.data ?? [];

  interface DisplayRow {
    key: string;
    name: string;
    category: string;
    unit: string | null;
    quantity: number;
    unitPrice: number;
    totalHt: number;
    isPerishable: boolean | null;
    notes: string | null;
    liveItem: StockItem | null;
  }

  const displayRows: DisplayRow[] = isLive
    ? items.map((it) => ({
        key: it.id,
        name: it.name,
        category: it.category,
        unit: it.unit,
        quantity: it.current_quantity,
        unitPrice: it.unit_price_ht,
        totalHt: it.current_quantity * it.unit_price_ht,
        isPerishable: it.is_perishable,
        notes: it.notes,
        liveItem: it,
      }))
    : snapshots
        .filter((s) => s.source_sheet === `Stock ${selectedYear}`)
        .map((s) => ({
          key: s.id,
          name: s.item_label,
          category: s.category ?? "Non catégorisé",
          unit: s.unit,
          quantity: s.quantity ?? 0,
          unitPrice: s.unit_price_ht ?? 0,
          totalHt: s.total_ht ?? 0,
          isPerishable: s.is_perishable,
          notes: s.observations,
          liveItem: null,
        }));

  const totalValue = displayRows.reduce((sum, r) => sum + r.totalHt, 0);
  const perishableValue = displayRows
    .filter((r) => r.isPerishable)
    .reduce((sum, r) => sum + r.totalHt, 0);
  const yearlyValue = importSnapshotsYearlyValue(snapshots);
  const rowsByCategory = new Map<string, DisplayRow[]>();
  for (const r of displayRows) {
    const list = rowsByCategory.get(r.category) ?? [];
    list.push(r);
    rowsByCategory.set(r.category, list);
  }
  const sortedCategories = [...rowsByCategory.keys()].sort((a, b) => a.localeCompare(b));

  function exportStockState() {
    const label = isLive ? new Date().toISOString().slice(0, 10) : `${selectedYear}-historique`;
    const rows = displayRows.map((r) => ({
      Article: r.name,
      Catégorie: r.category,
      Unité: r.unit ?? "",
      Quantité: r.quantity,
      "Prix unitaire HT": r.unitPrice,
      "Total HT": Math.round(r.totalHt * 100) / 100,
      Périssable: r.isPerishable ? "OUI" : "NON",
      Observations: r.notes ?? "",
    }));
    downloadCsv(`etat-des-stocks-${label}.csv`, toCsv(rows));
  }

  return (
    <div key={selectedYear} className="w-full space-y-6 px-4 py-5 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold tracking-tight">Stock</h1>
          <p className="text-sm text-muted-foreground">
            {isLive
              ? "Inventaire à jour, mouvements en temps réel et historique importé."
              : `Vue historique — état des stocks importé pour ${selectedYear}, lecture seule.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportStockState}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Exporter l'état des stocks
          </Button>
          {isLive && <BulkAddStockItemsDialog onCreated={refresh} />}
          {isLive && <AddStockMovementDialog items={items} onCreated={refresh} />}
        </div>
      </div>

      {!isLive && (
        <Badge variant="secondary" className="w-fit">
          Exercice {selectedYear} — données figées, non modifiables
        </Badge>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Valeur totale HT" value={formatEuro(totalValue)} />
        <Kpi label="Articles suivis" value={String(displayRows.length)} />
        <Kpi label="Valeur périssable" value={formatEuro(perishableValue)} />
        <Kpi label="Catégories" value={String(sortedCategories.length)} />
      </div>

      <Tabs defaultValue="inventaire">
        <TabsList className="flex-wrap">
          <TabsTrigger value="inventaire">Inventaire</TabsTrigger>
          <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
          <TabsTrigger value="historique">Historique importé</TabsTrigger>
        </TabsList>

        <TabsContent value="inventaire" className="mt-4">
          {displayRows.length === 0 ? (
            <EmptyState
              title="Aucun article"
              description={
                isLive
                  ? "Enregistre un premier mouvement pour créer un article."
                  : `Aucun inventaire importé pour ${selectedYear}.`
              }
            />
          ) : (
            <div className="space-y-3">
              {sortedCategories.map((cat) => {
                const catRows = rowsByCategory.get(cat)!;
                const catValue = catRows.reduce((sum, r) => sum + r.totalHt, 0);
                const isCollapsed = collapsedCategories.has(cat);
                return (
                  <Collapsible
                    key={cat}
                    open={!isCollapsed}
                    onOpenChange={() => toggleCategory(cat)}
                  >
                    <Card>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                          <span className="flex items-center gap-2 font-semibold">
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                            />
                            {cat}
                            <span className="text-xs font-normal text-muted-foreground">
                              ({catRows.length})
                            </span>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatEuro(catValue)}
                          </span>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Article</TableHead>
                                <TableHead>Unité</TableHead>
                                <TableHead className="text-right">Quantité</TableHead>
                                <TableHead className="text-right">Prix unitaire HT</TableHead>
                                <TableHead className="text-right">Total HT</TableHead>
                                <TableHead>Périssable</TableHead>
                                <TableHead>Observations</TableHead>
                                {isLive && <TableHead className="w-10" />}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {catRows.map((r) => (
                                <TableRow key={r.key}>
                                  <TableCell className="font-medium">{r.name}</TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {r.unit ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-right">{r.quantity}</TableCell>
                                  <TableCell className="text-right">
                                    {formatEuro(r.unitPrice)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatEuro(r.totalHt)}
                                  </TableCell>
                                  <TableCell>
                                    {r.isPerishable ? (
                                      <Leaf
                                        className="h-4 w-4 text-emerald-600"
                                        aria-label="Périssable"
                                      />
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                                    {r.notes ?? ""}
                                  </TableCell>
                                  {isLive && r.liveItem && (
                                    <TableCell>
                                      <div className="flex justify-end gap-1">
                                        <AddStockMovementDialog
                                          items={items}
                                          onCreated={refresh}
                                          presetItem={r.liveItem}
                                          presetMovementType="perte"
                                          trigger={
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-destructive hover:text-destructive"
                                              aria-label={`Déclarer une perte pour ${r.name}`}
                                            >
                                              <AlertTriangle className="h-3.5 w-3.5" />
                                            </Button>
                                          }
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => setEditingItem(r.liveItem)}
                                          aria-label={`Modifier ${r.name}`}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mouvements" className="mt-4">
          {movements.length === 0 ? (
            <EmptyState
              title="Aucun mouvement"
              description="Les entrées et sorties de stock apparaîtront ici."
            />
          ) : (
            <Card>
              <CardContent className="divide-y divide-border pt-4">
                {movements.map((mv) => {
                  const Icon = MOVEMENT_ICON[mv.movement_type];
                  return (
                    <div key={mv.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="w-24 shrink-0 text-xs text-muted-foreground">
                        {new Date(mv.occurred_at).toLocaleDateString("fr-FR")}
                      </span>
                      <Badge variant={MOVEMENT_BADGE_VARIANT[mv.movement_type]} className="gap-1">
                        <Icon className="h-3.5 w-3.5" />
                        {STOCK_MOVEMENT_TYPE_LABELS[mv.movement_type]}
                      </Badge>
                      <span className="flex-1 font-medium">
                        {mv.item?.name ?? "Article supprimé"}
                      </span>
                      <span className="font-medium">{mv.quantity}</span>
                      {mv.reason && (
                        <span className="w-48 shrink-0 truncate text-right text-xs text-muted-foreground">
                          {mv.reason}
                        </span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="historique" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Inventaires importés (référence et audit) — n'alimente pas l'inventaire courant.
          </p>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Valeur du stock par inventaire</CardTitle>
            </CardHeader>
            <CardContent>
              {yearlyValue.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Aucun historique importé
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={yearlyValue.map((y) => ({ ...y, label: y.sourceSheet }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis fontSize={12} unit="€" />
                    <Tooltip formatter={(v: number) => formatEuro(v)} />
                    <Bar dataKey="totalHt" fill={PP_COLORS.sales} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editingItem && (
        <EditStockItemDialog
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(v) => !v && setEditingItem(null)}
          onUpdated={refresh}
        />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
