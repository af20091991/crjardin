import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { listPageFollowUp, syncRadarFollowUp } from "@/lib/visibilite-locale-follow.functions";
import type { Effect, PageFollowUp } from "@/lib/visibilite-locale-follow";
import type { ScoredOpportunity } from "@/lib/visibilite-locale";

const FOLLOW_KEY = ["visibilite-locale-follow"];

const dateFr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function EffectCell({ effect, label }: { effect: Effect; label: string }) {
  if (effect.status === "attente") {
    return (
      <span className="text-muted-foreground">
        {label} : le {dateFr(effect.availableOn)}
      </span>
    );
  }
  return (
    <span>
      {label} : clics {signed(effect.deltaClicks ?? 0)}, impressions{" "}
      {signed(effect.deltaImpressions ?? 0)}, position {signed(effect.deltaPosition ?? 0)}
    </span>
  );
}

export function RadarFollowUp({
  opportunities,
  generatedAt,
}: {
  opportunities: ScoredOpportunity[];
  generatedAt: string;
}) {
  const queryClient = useQueryClient();
  const lastSync = useRef<string | null>(null);

  const sync = useMutation({
    mutationFn: () =>
      syncRadarFollowUp({
        data: {
          opportunities: opportunities.map((o) => ({
            key: o.key,
            prestation: o.prestation,
            commune: o.commune,
            score: o.score,
            impressions: o.impressions,
            clicks: o.clicks,
            position: o.position,
            travelMinutes: o.travelMinutes,
            travelKm: o.travelKm,
          })),
        },
      }),
    onSuccess: (r) => {
      if (r.ok && r.alerts > 0)
        toast.info(`${r.alerts} nouvelle(s) opportunité(s) forte(s) signalée(s)`);
      void queryClient.invalidateQueries({ queryKey: FOLLOW_KEY });
    },
  });

  useEffect(() => {
    if (lastSync.current === generatedAt || opportunities.length === 0) return;
    lastSync.current = generatedAt;
    sync.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une synchronisation par jeu de données
  }, [generatedAt, opportunities.length]);

  const pages = useQuery({ queryKey: FOLLOW_KEY, queryFn: () => listPageFollowUp() });
  const rows: PageFollowUp[] = pages.data ?? [];

  return (
    <Card className="p-4">
      <h3 className="font-serif text-base font-semibold">Suivi des pages préparées</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Comparaison avant/après à 4 semaines (option 8 semaines). Indicatif : Search Console est lue
        sur 90 jours glissants.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune page préparée pour l’instant.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((p) => (
            <li key={p.slug} className="rounded-md border p-3">
              <p className="font-medium">
                {p.prestation} · {p.commune}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  créée le {dateFr(p.createdAt)}
                </span>
              </p>
              <p className="text-xs">
                <EffectCell effect={p.effect} label="4 semaines" />
              </p>
              <p className="text-xs">
                <EffectCell effect={p.longEffect} label="8 semaines" />
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
