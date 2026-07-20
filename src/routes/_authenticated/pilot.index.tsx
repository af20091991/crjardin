import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { KpiCard } from "@/components/pilot/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { computeKpis, formatEuro, DEFAULT_SETTINGS } from "@/lib/pilot";
import { listAllInterventions } from "@/lib/interventions";
import { listAllRecommendations } from "@/lib/garden";
import { listGoals } from "@/lib/pilot-goals";
import { supabase } from "@/integrations/supabase/client";
import {
  Euro, Wallet, Target, CalendarDays, Sparkles, AlertTriangle, FileText,
  Clock, Handshake, Users, CheckCircle2, ArrowRight, Send,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/")({
  head: () => ({ meta: [{ title: "Aujourd'hui — Pilot Pro" }] }),
  component: TodayPage,
});

type NBOffer = {
  client_id: string;
  service_id: string;
  service_name: string;
  score_opportunity: number;
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function isSameDay(a: string, b: Date): boolean {
  const d = new Date(a);
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
}
function inRange(a: string, from: Date, to: Date): boolean {
  const t = new Date(a).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function TodayPage() {
  const { entries, charges, settings } = usePilotData();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const interventions = useQuery({ queryKey: ["interventions-all"], queryFn: listAllInterventions });
  const recos = useQuery({ queryKey: ["recommendations-all"], queryFn: listAllRecommendations });
  const goals = useQuery({ queryKey: ["pilot-goals"], queryFn: listGoals });
  const priorityOffers = useQuery({
    queryKey: ["nbo-priority"],
    queryFn: async (): Promise<NBOffer[]> => {
      const { data, error } = await supabase
        .from("v_client_next_best_offers" as never)
        .select("client_id, service_id, service_name, score_opportunity")
        .gte("score_opportunity", 80)
        .order("score_opportunity", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as NBOffer[];
    },
  });

  const loading =
    entries.isLoading || charges.isLoading || settings.isLoading ||
    interventions.isLoading || recos.isLoading || goals.isLoading;

  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const k = useMemo(
    () =>
      computeKpis({
        entries: entries.data ?? [],
        charges: charges.data ?? [],
        settings: set,
        year,
        month,
      }),
    [entries.data, charges.data, set, year, month],
  );

  // Objectif du mois = CA du même mois N-1 (référentiel factuel, aucune nouvelle donnée)
  const objectifMois = useMemo(() => {
    const rows = (entries.data ?? []).filter((e) => {
      const d = new Date(e.entry_date);
      return d.getFullYear() === year - 1 && d.getMonth() === month;
    });
    return rows.reduce((s, e) => s + e.amount_ht, 0);
  }, [entries.data, year, month]);
  const avancement = objectifMois > 0 ? (k.caMonth / objectifMois) * 100 : 0;

  const beneficeMois = useMemo(() => {
    // approximation : marge annuelle appliquée au CA du mois
    const marge = k.marge / 100;
    return k.caMonth * marge;
  }, [k]);

  const allI = interventions.data ?? [];
  const allR = recos.data ?? [];
  const allG = goals.data ?? [];

  const today = new Date();
  const wStart = startOfWeek(today);
  const wEnd = endOfWeek(today);

  const planningToday = allI.filter((i) => isSameDay(i.intervention_date, today));
  const planningWeek = allI.filter((i) => inRange(i.intervention_date, wStart, wEnd));

  const acceptedNotPlanned = allR.filter(
    (r) => r.status === "acceptee" && !r.planned_intervention_id,
  );
  const terminatedNoReport = allI.filter(
    (i) => i.status === "termine" && !i.sent_to_client_at,
  );
  const missingHours = allI.filter((i) => {
    if (i.status !== "termine") return false;
    const estimated =
      i.ai_metadata && typeof i.ai_metadata === "object" &&
      (i.ai_metadata as Record<string, unknown>).hours_estimated === true;
    return i.hours_spent == null || estimated;
  });

  // Clients dormants (dernière intervention > 180 j)
  const DAY = 24 * 60 * 60 * 1000;
  const lastByClient = new Map<string, number>();
  allI.forEach((i) => {
    const t = new Date(i.intervention_date).getTime();
    const prev = lastByClient.get(i.client_id) ?? 0;
    if (t > prev) lastByClient.set(i.client_id, t);
  });
  const dormants = Array.from(lastByClient.entries()).filter(
    ([, t]) => today.getTime() - t > 180 * DAY,
  );

  // Objectifs mensuels en retard : status en_cours & deadline < aujourd'hui
  const goalsLate = allG.filter((g) => {
    if (g.status !== "en_cours" || !g.deadline) return false;
    return new Date(g.deadline).getTime() < today.setHours(0, 0, 0, 0);
  });

  const priority = priorityOffers.data ?? [];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Bonjour, voici votre journée
        </h2>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Performance du jour */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Performance du mois</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="CA du mois" value={formatEuro(k.caMonth)} icon={Euro} to="/pilot/ca" />
          <KpiCard
            label="Objectif du mois"
            value={objectifMois > 0 ? formatEuro(objectifMois) : "—"}
            sub={objectifMois > 0 ? `Réf. ${year - 1}` : "Pas d'historique N-1"}
            icon={Target}
          />
          <KpiCard
            label="Avancement"
            value={objectifMois > 0 ? `${avancement.toFixed(0)} %` : "—"}
            icon={CheckCircle2}
            progress={objectifMois > 0 ? avancement : undefined}
            tone={avancement >= 100 ? "positive" : avancement >= 60 ? "default" : "warning"}
          />
          <KpiCard
            label="Bénéfice estimé (mois)"
            value={formatEuro(beneficeMois)}
            icon={Wallet}
            tone={beneficeMois >= 0 ? "positive" : "negative"}
            sub={`Marge ${k.marge.toFixed(0)} %`}
          />
        </div>
      </section>

      {/* Actions prioritaires */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Actions prioritaires
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <ActionCard
            icon={Handshake}
            title="Recommandations acceptées à planifier"
            count={acceptedNotPlanned.length}
            to="/pilot/direction"
            emptyLabel="Rien à planifier"
          />
          <ActionCard
            icon={FileText}
            title="Interventions terminées sans compte-rendu envoyé"
            count={terminatedNoReport.length}
            to="/interventions"
            emptyLabel="Tous les CR sont envoyés"
          />
          <ActionCard
            icon={Clock}
            title="Interventions sans heures confirmées"
            count={missingHours.length}
            to="/interventions"
            emptyLabel="Toutes les heures sont confirmées"
          />
          <ActionCard
            icon={Sparkles}
            title="Opportunités prioritaires (score ≥ 80)"
            count={priority.length}
            to="/pilot/clients"
            emptyLabel="Aucune opportunité prioritaire"
          />
        </div>
      </section>

      {/* Planning */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Planning</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h4 className="font-medium">Aujourd'hui</h4>
                <Badge variant="secondary" className="ml-auto">{planningToday.length}</Badge>
              </div>
              {planningToday.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune intervention prévue aujourd'hui.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {planningToday.slice(0, 6).map((i) => (
                    <li key={i.id}>
                      <Link
                        to="/interventions/$interventionId"
                        params={{ interventionId: i.id }}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-accent/40"
                      >
                        <span className="truncate">{i.title ?? i.intervention_type ?? "Intervention"}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h4 className="font-medium">Cette semaine</h4>
                <Badge variant="secondary" className="ml-auto">{planningWeek.length}</Badge>
              </div>
              {planningWeek.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune intervention prévue cette semaine.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {planningWeek.slice(0, 6).map((i) => (
                    <li key={i.id}>
                      <Link
                        to="/interventions/$interventionId"
                        params={{ interventionId: i.id }}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-accent/40"
                      >
                        <span className="truncate">
                          {new Date(i.intervention_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}
                          {" · "}
                          {i.title ?? i.intervention_type ?? "Intervention"}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Alertes */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Alertes</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <AlertCard
            icon={Users}
            title="Clients dormants"
            count={dormants.length}
            hint="Sans intervention depuis + de 6 mois"
            to="/pilot/clients"
          />
          <AlertCard
            icon={Send}
            title="Comptes-rendus non envoyés"
            count={terminatedNoReport.length}
            hint="Intervention terminée sans envoi client"
            to="/interventions"
          />
          <AlertCard
            icon={AlertTriangle}
            title="Objectifs en retard"
            count={goalsLate.length}
            hint="Échéance dépassée, statut en cours"
            to="/pilot/objectifs"
          />
        </div>
      </section>
    </div>
  );
}

function ActionCard({
  icon: Icon, title, count, to, emptyLabel,
}: {
  icon: typeof Handshake; title: string; count: number; to: string; emptyLabel: string;
}) {
  const empty = count === 0;
  return (
    <Link to={to}>
      <Card className="h-full p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary/80" />
            <p className="text-sm font-medium">{title}</p>
          </div>
          <Badge variant={empty ? "outline" : "default"} className="shrink-0">
            {count}
          </Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {empty ? emptyLabel : "Cliquer pour ouvrir la liste"}
        </p>
      </Card>
    </Link>
  );
}

function AlertCard({
  icon: Icon, title, count, hint, to,
}: {
  icon: typeof AlertTriangle; title: string; count: number; hint: string; to: string;
}) {
  const active = count > 0;
  return (
    <Link to={to}>
      <Card
        className={`h-full p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
          active ? "border-amber-300 bg-amber-50/60" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${active ? "text-amber-600" : "text-muted-foreground"}`} />
            <p className="text-sm font-medium">{title}</p>
          </div>
          <span className={`font-serif text-lg font-semibold ${active ? "text-amber-700" : "text-muted-foreground"}`}>
            {count}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </Card>
    </Link>
  );
}