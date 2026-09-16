import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Leaf, ArrowDownCircle, ArrowUpCircle, Settings2, Pencil } from "lucide-react";

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

  return (
    <div className="w-full space-y-6 px-4 py-5 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold tracking-tight">Stock</h1>
          <p className="text-sm text-muted-foreground">
            Inventaire à jour, mouvements en temps réel et historique importé.
          </p>
        </div>
        <AddStockMovementDialog items={items} onCreated={refresh} />
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
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Valeur HT</TableHead>
                      <TableHead>Périssable</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCategories.map((cat) => {
                      const catItems = itemsByCategory.get(cat)!;
                      const catValue = catItems.reduce(
                        (sum, it) => sum + it.current_quantity * it.unit_price_ht,
                        0,
                      );
                      return (
                        <Fragment key={cat}>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={4} className="py-2 font-semibold">
                              {cat}
                            </TableCell>
                            <TableCell className="py-2 text-right text-xs text-muted-foreground">
                              {formatEuro(catValue)}
                            </TableCell>
                          </TableRow>
                          {catItems.map((it) => (
                            <TableRow key={it.id}>
                              <TableCell className="font-medium">{it.name}</TableCell>
                              <TableCell className="text-right">
                                {it.current_quantity}
                                {it.unit ? ` ${it.unit}` : ""}
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
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
