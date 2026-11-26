import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { getSharedNotifications } from "@/lib/premium-notifications.functions";

const KIND_LABEL: Record<string, string> = {
  cr: "Compte-rendu",
  recommendation: "Préconisation",
  document: "Document",
  photos: "Photos",
  calendar: "Calendrier",
  garden: "Suivi du jardin",
  message: "Message",
};

/** Dernières nouveautés envoyées par le jardinier (uniquement celles validées). */
export function PremiumNews({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["premium-news", token],
    queryFn: () => getSharedNotifications({ data: { token } }),
    retry: false,
  });
  const items = (query.data ?? []).slice(0, 5);
  if (items.length === 0) return null;

  return (
    <section className="mb-10 space-y-4" aria-label="Nouveautés">
      <h2 className="flex items-center gap-2 font-premium-serif text-2xl font-medium">
        <Sparkles className="size-5 text-primary" strokeWidth={1.5} />
        Nouveautés
      </h2>
      <ul className="divide-y rounded-2xl border">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:justify-between"
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-primary">
                {KIND_LABEL[item.kind] ?? "Information"}
              </p>
              <p className="font-medium">{item.title}</p>
              {item.body && <p className="text-sm text-muted-foreground">{item.body}</p>}
            </div>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.sent_at}>
              {new Date(item.sent_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
              })}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
