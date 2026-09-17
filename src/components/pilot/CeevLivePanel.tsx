import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock, Clock, FileClock, TrendingUp, Users, Wallet } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import { CEEV_LIVE_CLASS_META, getCeevLiveYear, type CeevLiveClient } from "@/lib/ceev-live";

export function CeevLivePanel() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const q = useQuery({ queryKey: ["ceev-live", year], queryFn: () => getCeevLiveYear(year) });
  const years = useMemo(() => [thisYear, thisYear - 1, thisYear - 2], [thisYear]);
  const data = q.data;
  const avgTaux = data && data.totals.hours > 0 ? data.totals.ca / data.totals.hours : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" /> CEEV temps réel
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">Bêta</Badge>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Calculé directement depuis les lignes CEEV du chiffre d'affaires.</p>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <LiveKpi icon={TrendingUp} label="CA encaissé (réglé)" value={formatEuro(data?.totals.ca ?? 0)} loading={q.isLoading} />
        <LiveKpi icon={FileClock} label="Facturé non réglé" value={formatEuro(data?.totals.caFactureNonRegle ?? 0)} loading={q.isLoading} />
        <LiveKpi icon={CalendarClock} label="Prévisionnel" value={formatEuro(data?.totals.caPlanifie ?? 0)} loading={q.isLoading} />
        <LiveKpi icon={Wallet} label="Marge réalisée" value={formatEuro(data?.totals.margin ?? 0)} loading={q.isLoading} />
        <LiveKpi icon={Clock} label="Taux horaire moyen" value={avgTaux != null ? `${avgTaux.toFixed(0)} €/h` : "—"} loading={q.isLoading} />
        <LiveKpi icon={Users} label="Clients CEEV suivis" value={String(data?.clients.length ?? 0)} loading={q.isLoading} />
      </div>

      <Card>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : !data || data.clients.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Aucune ligne CA catégorisée « CEEV » avec un client identifié pour {year}.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Client</TableHead><TableHead className="text-right">CA encaissé</TableHead><TableHead className="text-right">En attente / prévu</TableHead><TableHead className="text-right">Charges</TableHead><TableHead className="text-right">Marge</TableHead><TableHead className="text-right">Heures</TableHead><TableHead className="text-right">Taux horaire</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                <TableBody>{data.clients.map((client) => <LiveClientRow key={client.clientId} client={client} />)}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LiveKpi({ icon: Icon, label, value, loading }: { icon: typeof TrendingUp; label: string; value: string; loading: boolean }) {
  return <Card><CardContent className="flex items-center gap-3 pt-5"><div className="rounded-full bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold tabular-nums">{loading ? "…" : value}</p></div></CardContent></Card>;
}

function LiveClientRow({ client }: { client: CeevLiveClient }) {
  const meta = CEEV_LIVE_CLASS_META[client.classe];
  return <TableRow><TableCell className="font-medium">{client.clientName}</TableCell><TableCell className="text-right tabular-nums">{formatEuro(client.ca)}</TableCell><TableCell className="text-right text-xs text-muted-foreground">{client.caFactureNonRegle > 0 ? `${formatEuro(client.caFactureNonRegle)} facturé` : client.caPlanifie > 0 ? `${formatEuro(client.caPlanifie)} prévu` : "—"}</TableCell><TableCell className="text-right tabular-nums text-muted-foreground">{formatEuro(client.charges)}</TableCell><TableCell className="text-right tabular-nums">{formatEuro(client.margin)}</TableCell><TableCell className="text-right tabular-nums">{client.hours.toFixed(1)} h</TableCell><TableCell className="text-right tabular-nums">{client.tauxHoraire != null ? `${client.tauxHoraire.toFixed(0)} €/h` : "—"}</TableCell><TableCell><Badge variant="outline" className={meta.badge} title={client.why}>{meta.label}</Badge></TableCell></TableRow>;
}
