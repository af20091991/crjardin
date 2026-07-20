import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { clientStatsWithHours, fetchConfirmedHoursByClient, formatEuro } from "@/lib/pilot";
import { getClientNote, saveClientNote } from "@/lib/pilot-client-notes";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Phone, Mail, MessageSquare, Save, TrendingUp, Clock, Users, PiggyBank, Activity, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pilot/clients/$clientKey")({
  head: () => ({ meta: [{ title: "Fiche client — Pilot Pro" }] }),
  component: PilotClientDetail,
});

function PilotClientDetail() {
  const { clientKey } = Route.useParams();
  const key = decodeURIComponent(clientKey);
  const qc = useQueryClient();
  const { entries, clients } = usePilotData();

  const confirmed = useQuery({
    queryKey: ["confirmed-hours-by-client", "all"],
    queryFn: () => fetchConfirmedHoursByClient(undefined),
  });

  const stat = useMemo(() => {
    const all = clientStatsWithHours(entries.data ?? [], undefined, confirmed.data);
    return all.find((s) => s.key === key);
  }, [entries.data, key, confirmed.data]);

  const client = useMemo(() => {
    if (!clients.data) return null;
    if (stat?.clientId) return clients.data.find((c) => c.id === stat.clientId) ?? null;
    // Fallback: match by name (case-insensitive)
    const target = (stat?.name ?? "").toLowerCase().trim();
    return clients.data.find((c) => c.name.toLowerCase().trim() === target) ?? null;
  }, [clients.data, stat]);

  const clientId = client?.id ?? null;

  const interventionsQ = useQuery({
    queryKey: ["client-interventions", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("interventions")
        .select("id,intervention_date,intervention_type,summary,garden_state")
        .eq("client_id", clientId)
        .order("intervention_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });

  const recosQ = useQuery({
    queryKey: ["client-recos", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("recommendations")
        .select("id,title,description,category,status,created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });

  const healthQ = useQuery({
    queryKey: ["client-health", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("garden_health")
        .select("id,zone,rating,note,assessed_on")
        .eq("client_id", clientId)
        .order("assessed_on", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });

  const noteQ = useQuery({ queryKey: ["pilot-client-note", key], queryFn: () => getClientNote(key) });
  const [note, setNote] = useState("");
  useEffect(() => { if (noteQ.data !== undefined) setNote(noteQ.data); }, [noteQ.data]);
  const noteMut = useMutation({
    mutationFn: (v: string) => saveClientNote(key, v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pilot-client-note", key] }); toast.success("Commentaire enregistré"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (entries.isLoading || clients.isLoading) return <Skeleton className="h-96 rounded-xl" />;

  if (!stat) {
    return (
      <div className="space-y-3">
        <Link to="/pilot/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Retour</Link>
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Client introuvable dans les données Pilotage.</CardContent></Card>
      </div>
    );
  }

  const natBreakdown = Object.entries(stat.natureBreakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/pilot/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Retour au classement
        </Link>
        {client && (
          <Link to="/clients/$clientId" params={{ clientId: client.id }}>
            <Button variant="outline" size="sm">Fiche client complète</Button>
          </Link>
        )}
      </div>

      {/* En-tête client */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-2xl font-semibold">{stat.name}</h1>
                <Badge>{stat.nature}</Badge>
                <Badge variant="secondary">Catégorie {stat.abc}</Badge>
                {client?.contract_type && <Badge variant="outline">{client.contract_type}</Badge>}
              </div>
              {client && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {client.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{client.address}</span>}
                  {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
                  {client.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
                  {client.frequency && <span>Fréquence : {client.frequency}</span>}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI chiffres */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat icon={TrendingUp} label="CA total" value={formatEuro(stat.ca)} sub={`${stat.share.toFixed(1)} % du portefeuille`} />
        <MiniStat icon={Users} label="Interventions" value={String(stat.count)} sub={stat.lastDate ? `Dernière : ${new Date(stat.lastDate).toLocaleDateString("fr-FR")}` : undefined} />
        <MiniStat icon={PiggyBank} label="CA moyen / interv." value={formatEuro(stat.avgCa)} />
        <MiniStat icon={Clock} label="Temps moyen / interv." value={`${stat.avgTime.toFixed(1)} h`} sub={`Taux ${formatEuro(stat.hourlyRate)}/h`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Répartition par nature */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Répartition CA par nature</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {natBreakdown.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée.</p>}
            {natBreakdown.map(([nature, amount]) => {
              const pct = stat.ca > 0 ? (amount / stat.ca) * 100 : 0;
              return (
                <div key={nature} className="space-y-1">
                  <div className="flex justify-between text-sm"><span className="font-medium">{nature}</span><span className="text-muted-foreground">{formatEuro(amount)} · {pct.toFixed(0)} %</span></div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Notes du client (base clients) */}
        {client?.notes && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Notes du fichier client</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{client.notes}</p></CardContent>
          </Card>
        )}
      </div>

      {/* Commentaire libre pilotage */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" />Commentaire pilotage</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes internes sur ce client (stratégie commerciale, points d'attention, historique…)" className="min-h-[120px]" />
          <div className="flex justify-end"><Button size="sm" onClick={() => noteMut.mutate(note)} disabled={noteMut.isPending}><Save className="mr-1.5 h-4 w-4" />Enregistrer</Button></div>
        </CardContent>
      </Card>

      {/* Interventions */}
      {clientId && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Interventions récentes</CardTitle></CardHeader>
          <CardContent>
            {interventionsQ.isLoading ? <Skeleton className="h-20" /> : (interventionsQ.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Aucune intervention enregistrée.</p> : (
              <ul className="space-y-2">
                {(interventionsQ.data ?? []).map((iv) => (
                  <li key={iv.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span>{new Date(iv.intervention_date).toLocaleDateString("fr-FR")}</span>
                        <Badge variant="outline">{iv.intervention_type ?? "Entretien"}</Badge>
                      </div>
                      <Link to="/interventions/$interventionId" params={{ interventionId: iv.id }} className="text-xs text-primary hover:underline">Ouvrir →</Link>
                    </div>
                    {iv.summary && <p className="mt-1.5 text-sm text-muted-foreground">{iv.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Préconisations */}
      {clientId && (recosQ.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Préconisations</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(recosQ.data ?? []).map((r) => (
                <li key={r.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{r.title}</span>
                    <Badge variant="secondary">{r.status ?? "en attente"}</Badge>
                  </div>
                  {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Santé du jardin */}
      {clientId && (healthQ.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Santé du jardin</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {(healthQ.data ?? []).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2">
                  <span>{h.zone ?? "Zone"}</span>
                  <span className="text-muted-foreground">{h.rating ?? "?"}/5 · {h.assessed_on ? new Date(h.assessed_on).toLocaleDateString("fr-FR") : ""}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <div className="mt-1.5 font-serif text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}