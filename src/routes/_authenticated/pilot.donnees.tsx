// Classeur Pilot Pro — une page, une question : « mes données de base
// sont-elles justes ? ». Édition manuelle tracée, journal des modifications
// avec annulation, et contrôle anti-régression des grands indicateurs.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, RotateCcw, ShieldCheck, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PilotDataGrid } from "@/components/pilot/PilotDataGrid";
import { DATASETS, displayCell, listEditLog, undoEdit, type EditLogEntry } from "@/lib/pilot-edit";
import {
  compareMetrics,
  listSnapshots,
  saveSnapshot,
  type MetricSet,
} from "@/lib/pilot-regression";
import { annualSummary } from "@/lib/pilot-annual";
import { listEntries } from "@/lib/pilot";
import { listChargeRows } from "@/lib/pilot-charges";
import { listClients } from "@/lib/clients";
import { currentYear } from "@/lib/date-utils";
import { APP_VERSION } from "@/lib/app-meta";

export const Route = createFileRoute("/_authenticated/pilot/donnees")({
  head: () => ({
    meta: [
      { title: "Classeur Pilot Pro — correction des données" },
      {
        name: "description",
        content:
          "Corriger manuellement les données Pilot Pro (CA, clients, CEEV, sous-traitance) avec historique et annulation.",
      },
      { property: "og:title", content: "Classeur Pilot Pro — correction des données" },
      {
        property: "og:description",
        content: "Édition manuelle tracée des données de pilotage et contrôle anti-régression.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DonneesPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number.isFinite(n) ? n : 0);

function DonneesPage() {
  const [tab, setTab] = useState(DATASETS[0].id);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl">Classeur des données</h1>
        <p className="text-sm text-muted-foreground">
          Mes données de base sont-elles justes ? Corrigez directement les valeurs : chaque modification
          est datée, motivée et annulable.
        </p>
      </header>

      {/* Bandeau explicatif : à quoi sert le classeur, et ce qu'il ne fait pas. */}
      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardContent className="space-y-1.5 pt-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">À quoi sert cette page ?</p>
          <p>
            Le classeur est la copie de travail de vos données de base : chiffre d'affaires, clients,
            contrats CEEV et sous-traitance. Vous y corrigez une valeur fausse ou manquante, exactement
            comme dans un tableur, sans passer par un import.
          </p>
          <p>
            Chaque correction est enregistrée dans le journal avec sa date, son ancienne valeur et son
            motif : elle est annulable à tout moment, et le contrôle anti-régression vérifie que les
            grands indicateurs n'ont pas bougé de façon anormale.
          </p>
          <p>
            Ce que le classeur ne fait pas : il ne calcule rien et n'invente aucune donnée. Les analyses
            (rentabilité, heures, décisions) sont recalculées ailleurs à partir des valeurs corrigées ici.
          </p>
          <p>
            Heures : les trois sources restent séparées et ne sont jamais additionnées — heures vendues
            (lignes CA), heures réalisées (interventions, source officielle) et heures historiques
            importées d'Excel.
          </p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {DATASETS.map((d) => (
            <TabsTrigger key={d.id} value={d.id}>
              <Table2 className="mr-1 h-3.5 w-3.5" />
              {d.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="journal">
            <History className="mr-1 h-3.5 w-3.5" />
            Journal
          </TabsTrigger>
          <TabsTrigger value="controle">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            Contrôle
          </TabsTrigger>
        </TabsList>

        {DATASETS.map((d) => (
          <TabsContent key={d.id} value={d.id} className="space-y-3 pt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{d.question}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">Écrans impactés :</span>
                  {d.impacts.map((i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {i}
                    </Badge>
                  ))}
                </div>
                <PilotDataGrid def={d} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="journal" className="pt-4">
          <EditJournal />
        </TabsContent>

        <TabsContent value="controle" className="pt-4">
          <RegressionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EditJournal() {
  const qc = useQueryClient();
  const { data: log = [], isLoading } = useQuery({
    queryKey: ["pilot-edit-log"],
    queryFn: () => listEditLog(),
  });

  const undo = useMutation({
    mutationFn: (e: EditLogEntry) => undoEdit(e),
    onSuccess: () => {
      toast.success("Modification annulée");
      qc.invalidateQueries({ queryKey: ["pilot-edit-log"] });
      qc.invalidateQueries({ queryKey: ["pilot-grid"] });
    },
    onError: (e: Error) => toast.error(e.message || "Annulation impossible"),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Historique des modifications manuelles</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Élément</TableHead>
                <TableHead>Champ</TableHead>
                <TableHead>Avant</TableHead>
                <TableHead>Après</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && log.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">
                    Aucune modification manuelle enregistrée.
                  </TableCell>
                </TableRow>
              )}
              {log.map((e) => (
                <TableRow key={e.id} className={e.undone_at ? "opacity-60" : undefined}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(e.created_at).toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate text-sm">{e.label ?? "—"}</TableCell>
                  <TableCell className="text-xs">{e.field}</TableCell>
                  <TableCell className="text-xs">{displayCell(e.before_value) || "—"}</TableCell>
                  <TableCell className="text-xs font-medium">{displayCell(e.after_value) || "—"}</TableCell>
                  <TableCell className="max-w-[14rem] truncate text-xs text-muted-foreground">
                    {e.reason ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {e.undone_at ? (
                      <Badge variant="outline">Annulée</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={undo.isPending}
                        onClick={() => undo.mutate(e)}
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                        Annuler
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function RegressionPanel() {
  const qc = useQueryClient();
  const year = currentYear();
  const [note, setNote] = useState("");

  const entries = useQuery({ queryKey: ["pilot-entries"], queryFn: () => listEntries() });
  const charges = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: () => listChargeRows() });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const snapshots = useQuery({
    queryKey: ["pilot-snapshots", year],
    queryFn: () => listSnapshots(year),
  });

  const metrics: MetricSet = useMemo(() => {
    const rows = annualSummary(entries.data ?? [], charges.data ?? [], { mode: "reel" });
    const row = rows.find((r) => r.year === year);
    return {
      ca: row?.caHt ?? 0,
      charges: row?.charges ?? 0,
      resultat: row?.beneficeBrut ?? 0,
      margePct: row?.margePct ?? 0,
      heures: row?.heuresVendues ?? 0,
      tauxHoraire: row?.tauxHoraireVendu ?? 0,
      clients: (clients.data ?? []).length,
    };
  }, [entries.data, charges.data, clients.data, year]);

  const previous = snapshots.data?.[0]?.metrics ?? null;
  const deltas = useMemo(() => compareMetrics(metrics, previous), [metrics, previous]);
  const alerts = deltas.filter((d) => d.alert).length;

  const snap = useMutation({
    mutationFn: () => saveSnapshot({ year, metrics, appVersion: APP_VERSION, note }),
    onSuccess: () => {
      toast.success("Photo des indicateurs enregistrée");
      setNote("");
      qc.invalidateQueries({ queryKey: ["pilot-snapshots", year] });
    },
    onError: (e: Error) => toast.error(e.message || "Enregistrement impossible"),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Contrôle anti-régression {year}
          {previous && (
            <Badge variant={alerts > 0 ? "destructive" : "outline"} className="ml-2">
              {alerts > 0 ? `${alerts} écart(s) à vérifier` : "Cohérent"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {previous
            ? `Comparaison avec la photo du ${new Date(snapshots.data![0].created_at).toLocaleString("fr-FR")}${
                snapshots.data![0].app_version ? ` (v${snapshots.data![0].app_version})` : ""
              }. Un écart de plus de 5 % est signalé.`
            : "Aucune photo de référence : enregistrez-en une pour détecter les variations lors des prochaines évolutions."}
        </p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicateur</TableHead>
                <TableHead className="text-right">Référence</TableHead>
                <TableHead className="text-right">Aujourd'hui</TableHead>
                <TableHead className="text-right">Écart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deltas.map((d) => (
                <TableRow key={d.key}>
                  <TableCell className="text-sm">{d.label}</TableCell>
                  <TableCell className="text-right text-sm">{d.before === null ? "—" : fmt(d.before)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{fmt(d.after)}</TableCell>
                  <TableCell
                    className={`text-right text-sm ${d.alert ? "font-semibold text-[var(--pp-charges)]" : "text-muted-foreground"}`}
                  >
                    {d.deltaPct === null ? "—" : `${d.deltaPct > 0 ? "+" : ""}${fmt(d.deltaPct)} %`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (ex. avant mise à jour v1.17)"
            className="h-9 max-w-sm"
          />
          <Button onClick={() => snap.mutate()} disabled={snap.isPending}>
            Enregistrer une photo de référence
          </Button>
        </div>

        {(snapshots.data ?? []).length > 0 && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {(snapshots.data ?? []).slice(0, 5).map((s) => (
              <li key={s.id}>
                {new Date(s.created_at).toLocaleString("fr-FR")} — CA {fmt(Number(s.metrics.ca ?? 0))} €
                {s.note ? ` — ${s.note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}