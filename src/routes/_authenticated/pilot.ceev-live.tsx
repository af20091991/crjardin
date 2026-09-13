import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkles, TrendingUp, Wallet, Clock, Users, FileClock, CalendarClock } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import { getCeevLiveYear, CEEV_LIVE_CLASS_META, type CeevLiveClient } from "@/lib/ceev-live";

export const Route = createFileRoute("/_authenticated/pilot/ceev-live")({
  head: () => ({
    meta: [
      { title: "CEEV temps réel (bêta) — Pilot Pro" },
      {
        name: "description",
        content:
          "Rentabilité CEEV calculée en direct à partir des lignes de Chiffre d'affaires, sans ressaisie.",
      },
    ],
  }),
  component: CeevLivePage,
});

function CeevLivePage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);

  const q = useQuery({
    queryKey: ["ceev-live", year],
    queryFn: () => getCeevLiveYear(year),
  });

  const years = useMemo(() => {
    const list = new Set([thisYear, thisYear - 1, thisYear - 2]);
    return Array.from(list).sort((a, b) => b - a);
  }, [thisYear]);

  const data = q.data;
  const avgTaux = data && data.totals.hours > 0 ? data.totals.ca / data.totals.hours : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Sparkles className="h-6 w-6 text-primary" /> CEEV — Temps réel
          <Badge variant="outline" className="ml-1 border-primary/30 bg-primary/5 text-primary">
            Bêta
          </Badge>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Rentabilité calculée en direct à partir des lignes « CEEV » déjà saisies dans le Chiffre
          d'affaires — aucune ressaisie de contrat n'est nécessaire. Les années antérieures sans
          lignes CA restent consultables sur{" "}
          <Link to="/pilot/ceev" className="underline underline-offset-2 hover:text-foreground">
            la page CEEV classique
          </Link>
          .
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CA encaissé (réglé)</p>
              <p className="text-lg font-semibold tabular-nums">
                {q.isLoading ? "…" : formatEuro(data?.totals.ca ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <FileClock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Facturé, en attente de règlement</p>
              <p className="text-lg font-semibold tabular-nums">
                {q.isLoading ? "…" : formatEuro(data?.totals.caFactureNonRegle ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="rounded-full bg-sky-100 p-2 text-sky-700">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prévisionnel (planifié)</p>
              <p className="text-lg font-semibold tabular-nums">
                {q.isLoading ? "…" : formatEuro(data?.totals.caPlanifie ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Marge réalisée</p>
              <p className="text-lg font-semibold tabular-nums">
                {q.isLoading ? "…" : formatEuro(data?.totals.margin ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Taux horaire moyen</p>
              <p className="text-lg font-semibold tabular-nums">
                {q.isLoading ? "…" : avgTaux != null ? `${avgTaux.toFixed(0)} €/h` : "—"}
              </p>
              {data && (
                <p className="text-xs text-muted-foreground">Cible : {data.targetHourlyRate} €/h</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clients CEEV suivis</p>
              <p className="text-lg font-semibold tabular-nums">
                {q.isLoading ? "…" : (data?.clients.length ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Détail par client */}
      <Card>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !data || data.clients.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucune ligne CA catégorisée « CEEV » avec un client identifié pour {year}.
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">CA encaissé</TableHead>
                      <TableHead className="text-right">En attente / prévu</TableHead>
                      <TableHead className="text-right">Charges</TableHead>
                      <TableHead className="text-right">Marge</TableHead>
                      <TableHead className="text-right">Heures</TableHead>
                      <TableHead className="text-right">Taux horaire</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.clients.map((c) => (
                      <ClientRow key={c.clientId} client={c} />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="space-y-2 p-4 md:hidden">
                {data.clients.map((c) => (
                  <ClientCard key={c.clientId} client={c} />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientRow({ client }: { client: CeevLiveClient }) {
  const meta = CEEV_LIVE_CLASS_META[client.classe];
  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          to="/clients/$clientId"
          params={{ clientId: client.clientId }}
          className="hover:underline"
        >
          {client.clientName}
        </Link>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatEuro(client.ca)}</TableCell>
      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
        {client.caFactureNonRegle > 0 && <div>{formatEuro(client.caFactureNonRegle)} facturé</div>}
        {client.caPlanifie > 0 && <div>{formatEuro(client.caPlanifie)} prévu</div>}
        {client.caFactureNonRegle === 0 && client.caPlanifie === 0 && "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {formatEuro(client.charges)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatEuro(client.margin)}</TableCell>
      <TableCell className="text-right tabular-nums">{client.hours.toFixed(1)} h</TableCell>
      <TableCell className="text-right tabular-nums">
        {client.tauxHoraire != null ? `${client.tauxHoraire.toFixed(0)} €/h` : "—"}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={meta.badge} title={client.why}>
          {meta.label}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

function ClientCard({ client }: { client: CeevLiveClient }) {
  const meta = CEEV_LIVE_CLASS_META[client.classe];
  return (
    <Link
      to="/clients/$clientId"
      params={{ clientId: client.clientId }}
      className="block rounded-lg border border-border bg-card p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{client.clientName}</p>
        <Badge variant="outline" className={meta.badge}>
          {meta.label}
        </Badge>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
        <span>CA encaissé : {formatEuro(client.ca)}</span>
        <span>Marge : {formatEuro(client.margin)}</span>
        <span>Heures : {client.hours.toFixed(1)} h</span>
        <span>
          Taux : {client.tauxHoraire != null ? `${client.tauxHoraire.toFixed(0)} €/h` : "—"}
        </span>
        {client.caFactureNonRegle > 0 && (
          <span>Facturé non réglé : {formatEuro(client.caFactureNonRegle)}</span>
        )}
        {client.caPlanifie > 0 && <span>Prévisionnel : {formatEuro(client.caPlanifie)}</span>}
      </div>
    </Link>
  );
}
