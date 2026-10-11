import { useCallback, useEffect, useState } from "react";
import { Activity, Info, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listAnalyticsProperties, runAnalyticsReport } from "@/lib/site-web-api";

const PREFERRED_GA4_PROPERTY_ID = "159443253";
const CONTACT_EVENT_PATTERN =
  /generate_lead|form_submit|contact_form|contact_submit|click_to_call|phone_click|email_click|appointment|book_appointment|request_quote|quote_request/i;

type EventRow = {
  name: string;
  count: number;
};

type AnalyticsRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

export function SiteWebCommercialEvents() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEvents(null);

    const propertiesResult = await listAnalyticsProperties();
    if (propertiesResult.error) {
      setError(propertiesResult.error);
      setLoading(false);
      return;
    }

    const properties = propertiesResult.data?.properties ?? [];
    const selected =
      properties.find((item) => item.name === `properties/${PREFERRED_GA4_PROPERTY_ID}`) ??
      properties.find((item) => item.name === PREFERRED_GA4_PROPERTY_ID) ??
      properties[0];
    if (!selected) {
      setError("Aucune propriété Google Analytics 4 accessible.");
      setLoading(false);
      return;
    }

    const result = await runAnalyticsReport({
      propertyId: selected.name.replace(/^properties\//, ""),
      startDate: daysAgo(30),
      endDate: yesterday(),
      dimensions: ["eventName"],
      metrics: ["eventCount"],
    });
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const report = result.data as { rows?: AnalyticsRow[] } | null;
    const rows = (report?.rows ?? [])
      .map((row) => ({
        name: row.dimensionValues?.[0]?.value ?? "Événement inconnu",
        count: Number(row.metricValues?.[0]?.value ?? 0),
      }))
      .sort((a, b) => b.count - a.count);
    setEvents(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const contactEvents = (events ?? []).filter((event) => CONTACT_EVENT_PATTERN.test(event.name));
  const contactEventCount = contactEvents.reduce((sum, event) => sum + event.count, 0);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold">Événements et signaux commerciaux</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Événements réellement remontés par GA4 sur les 30 derniers jours. Les événements
              reconnus comme contact sont classés d’après leur nom ; vérifiez leur configuration
              avant de les assimiler à des prospects qualifiés.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-muted-foreground">Événements indisponibles : {error}</p>
      ) : loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Lecture des événements GA4…</p>
      ) : events ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-sm text-muted-foreground">
                Événements correspondant à des contacts
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatNumber(contactEventCount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Somme des événements reconnus, pas nécessairement des demandes uniques.
              </p>
            </div>
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-sm text-muted-foreground">Types d’événements reçus</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatNumber(events.length)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Noms distincts fournis par GA4 sur la période.
              </p>
            </div>
          </div>

          {contactEvents.length === 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Aucun nom d’événement reconnu comme formulaire, appel, e-mail, devis ou rendez-vous.
              Cela ne prouve pas qu’aucune demande n’a été reçue : les événements peuvent être
              absents, mal nommés ou non configurés.
            </div>
          )}

          <div className="mt-5">
            <h4 className="text-sm font-medium">Événements de contact détectés</h4>
            {contactEvents.length ? (
              <div className="mt-2 space-y-2">
                {contactEvents.map((event) => (
                  <div
                    key={event.name}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="break-all">{event.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Contact potentiel</Badge>
                      <span className="font-medium tabular-nums">{formatNumber(event.count)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Aucun événement classé comme contact par le filtre de noms actuel.
              </p>
            )}
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-medium">Autres événements reçus</h4>
            <div className="mt-2 space-y-2">
              {events
                .filter((event) => !CONTACT_EVENT_PATTERN.test(event.name))
                .slice(0, 10)
                .map((event) => (
                  <div
                    key={event.name}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="break-all text-muted-foreground">{event.name}</span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatNumber(event.count)}
                    </span>
                  </div>
                ))}
              {events.filter((event) => !CONTACT_EVENT_PATTERN.test(event.name)).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun autre événement listé par GA4 sur cette période.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
      <p className="mt-4 text-xs text-muted-foreground">
        Source : Google Analytics 4 · période : {formatDate(daysAgo(30))} →{" "}
        {formatDate(yesterday())}. Un événement peut se déclencher plusieurs fois pour une même
        personne.
      </p>
    </Card>
  );
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function yesterday() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fr-FR").format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
