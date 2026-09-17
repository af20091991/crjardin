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
import { EditStockItemDialog } from "@/components/pilot/stock/EditStockItemDialog";
import { EmptyState } from "@/components/pilot/EmptyState";
import { formatEuro } from "@/lib/pilot";
import { PP_COLORS } from "@/lib/pilot-colors";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useIsAdmin } from "@/hooks/use-admin";
import {
  listStockItems,
  listStockMovements,
  listImportSnapshots,
  importSnapshotsYearlyValue,
  stockCategoryBreakdown,
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
};

const MOVEMENT_ICON: Record<StockMovementType, typeof ArrowDownCircle> = {
  entree: ArrowDownCircle,
  sortie: ArrowUpCircle,
  ajustement: Settings2,
};

function StockPage() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const movements = movementsQuery.data ?? [];
  const snapshots = snapshotsQuery.data ?? [];

  const totalValue = items.reduce((sum, it) => sum + it.current_quantity * it.unit_price_ht, 0);
  const perishableValue = items
    .filter((it) => it.is_perishable)
    .reduce((sum, it) => sum + it.current_quantity * it.unit_price_ht, 0);
  const categoryBreakdown = stockCategoryBreakdown(items);
  const yearlyValue = importSnapshotsYearlyValue(snapshots);
  const itemsByCategory = new Map<string, StockItem[]>();
  for (const it of items) {
    const list = itemsByCategory.get(it.category) ?? [];
    list.push(it);
    itemsByCategory.set(it.category, list);
  }
  const sortedCategories = [...itemsByCategory.keys()].sort((a, b) => a.localeCompare(b));

  function exportStockState() {
    const today = new Date().toISOString().slice(0, 10);
    const rows = items.map((it) => ({
      Article: it.name,
      Catégorie: it.category,
      Unité: it.unit ?? "",
      Quantité: it.current_quantity,
      "Prix unitaire HT": it.unit_price_ht,
      "Total HT": Math.round(it.current_quantity * it.unit_price_ht * 100) / 100,
      Périssable: it.is_perishable ? "OUI" : "NON",
      Observations: it.notes ?? "",
    }));
    downloadCsv(`etat-des-stocks-${today}.csv`, toCsv(rows));
  }

  return (
    <div className="w-full space-y-6 px-4 py-5 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold tracking-tight">Stock</h1>
          <p className="text-sm text-muted-foreground">
            Inventaire à jour, mouvements en temps réel et historique importé.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportStockState}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Exporter l'état des stocks
          </Button>
          <AddStockMovementDialog items={items} onCreated={refresh} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Valeur totale HT" value={formatEuro(totalValue)} />
        <Kpi label="Articles suivis" value={String(items.length)} />
        <Kpi label="Valeur périssable" value={formatEuro(perishableValue)} />
        <Kpi label="Catégories" value={String(categoryBreakdown.length)} />
      </div>

      <Tabs defaultValue="inventaire">
        <TabsList className="flex-wrap">
          <TabsTrigger value="inventaire">Inventaire</TabsTrigger>
          <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
          <TabsTrigger value="historique">Historique importé</TabsTrigger>
        </TabsList>

        <TabsContent value="inventaire" className="mt-4">
          {items.length === 0 ? (
            <EmptyState
              title="Aucun article"
              description="Enregistre un premier mouvement pour créer un article."
            />
          ) : (
            <div className="space-y-3">
              {sortedCategories.map((cat) => {
                const catItems = itemsByCategory.get(cat)!;
                const catValue = catItems.reduce(
                  (sum, it) => sum + it.current_quantity * it.unit_price_ht,
                  0,
                );
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
                              ({catItems.length})
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
                                <TableHead className="w-10" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {catItems.map((it) => (
                                <TableRow key={it.id}>
                                  <TableCell className="font-medium">{it.name}</TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {it.unit ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {it.current_quantity}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatEuro(it.unit_price_ht)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatEuro(it.current_quantity * it.unit_price_ht)}
                                  </TableCell>
                                  <TableCell>
                                    {it.is_perishable ? (
                                      <Leaf
                                        className="h-4 w-4 text-emerald-600"
                                        aria-label="Périssable"
                                      />
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                                    {it.notes ?? ""}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setEditingItem(it)}
                                      aria-label={`Modifier ${it.name}`}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TableCell>
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
