import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarDays, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  SST_ACTION_META,
  acknowledgeSstChanges,
  describeChangeLine,
  listUnseenSstChanges,
  type SstCalendarChange,
} from "@/lib/sst-calendar-changes";

export const SST_CHANGES_QUERY_KEY = ["sst-calendar-unseen-changes"];

/** Modifications non vues du calendrier SST, partagées par le bandeau et les repères de jours. */
export function useUnseenSstChanges(enabled: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: SST_CHANGES_QUERY_KEY,
    queryFn: listUnseenSstChanges,
    enabled,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`sst-calendar-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sst_calendar_changes" },
        () => qc.invalidateQueries({ queryKey: SST_CHANGES_QUERY_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);

  return query.data ?? [];
}

function whenLabel(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayLabel(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function SstChangesPanel({
  changes,
  onShowDay,
}: {
  changes: SstCalendarChange[];
  onShowDay: (isoDate: string) => void;
}) {
  const qc = useQueryClient();
  const acknowledge = useMutation({
    mutationFn: (ids: string[]) => acknowledgeSstChanges(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: SST_CHANGES_QUERY_KEY }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (changes.length === 0) return null;

  return (
    <section
      className="mb-4 overflow-hidden rounded-lg border-2 border-amber-400 bg-amber-50 shadow-sm"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-400/90 px-4 py-2.5 text-amber-950">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          <h2 className="text-sm font-semibold sm:text-base">
            {changes.length} modification{changes.length > 1 ? "s" : ""} du calendrier à consulter
          </h2>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={acknowledge.isPending}
          onClick={() => acknowledge.mutate(changes.map((change) => change.id))}
        >
          <CheckCheck className="mr-1.5 h-4 w-4" />
          Tout marquer comme vu
        </Button>
      </div>
      <ul className="max-h-96 divide-y divide-amber-200 overflow-y-auto">
        {changes.map((change) => {
          const meta = SST_ACTION_META[change.action];
          const day = dayLabel(change.calendar_date);
          return (
            <li
              key={change.id}
              className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-amber-900/70">
                    {whenLabel(change.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-amber-950">{change.summary}</p>
                {change.details.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {change.details.map((line, index) => (
                      <li
                        key={index}
                        className="rounded bg-white/70 px-2 py-1 text-xs text-amber-950"
                      >
                        {describeChangeLine(line)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {change.calendar_date && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onShowDay(change.calendar_date!)}
                    title={day ?? undefined}
                  >
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                    Voir le jour
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={acknowledge.isPending}
                  onClick={() => acknowledge.mutate([change.id])}
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Vu
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
