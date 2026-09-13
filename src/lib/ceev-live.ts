import { listCaEntries, type CaEntry } from "@/lib/pilot-ca";
import { listClients } from "@/lib/clients";
import { hoursCounted, revenueCounted } from "@/lib/pilot-sale-accounting";
import { getThresholds } from "@/lib/pilot-thresholds";
import { getSettings, DEFAULT_SETTINGS } from "@/lib/pilot";

export type CeevLiveClass =
  | "tres_rentable"
  | "rentable"
  | "a_surveiller"
  | "chronophage"
  | "non_classe";

export const CEEV_LIVE_CLASS_META: Record<CeevLiveClass, { label: string; badge: string }> = {
  tres_rentable: {
    label: "Très rentable",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rentable: { label: "Rentable", badge: "border-sky-200 bg-sky-50 text-sky-700" },
  a_surveiller: { label: "À surveiller", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  chronophage: { label: "Chronophage", badge: "border-red-200 bg-red-50 text-red-700" },
  non_classe: {
    label: "Données insuffisantes",
    badge: "border-border bg-muted text-muted-foreground",
  },
};

export interface CeevLiveClient {
  clientId: string;
  clientName: string;
  ca: number;
  charges: number;
  margin: number;
  hours: number;
  tauxHoraire: number | null;
  classe: CeevLiveClass;
  why: string;
}

export interface CeevLiveYear {
  year: number;
  targetHourlyRate: number;
  clients: CeevLiveClient[];
  totals: { ca: number; charges: number; margin: number; hours: number };
}

/**
 * Rentabilité CEEV en direct, calculée à partir des lignes de Chiffre d'affaires
 * déjà catégorisées « CEEV » (aucune ressaisie) — CA et charges comptabilisés
 * selon les mêmes règles que la page Chiffre d'affaires (Réglé / Facturé).
 */
export async function getCeevLiveYear(year: number): Promise<CeevLiveYear> {
  const [entries, clients, settings] = await Promise.all([
    listCaEntries(year),
    listClients(),
    getSettings().catch(() => null),
  ]);
  const targetHourlyRate = settings?.target_hourly_rate ?? DEFAULT_SETTINGS.target_hourly_rate;
  const thresholds = getThresholds();
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  const ceevEntries = entries.filter((e: CaEntry) => e.category === "CEEV" && e.client_id);

  const agg = new Map<string, { ca: number; charges: number; hours: number }>();
  for (const e of ceevEntries) {
    const key = e.client_id as string;
    const cur = agg.get(key) ?? { ca: 0, charges: 0, hours: 0 };
    if (e.kind === "vente") {
      if (revenueCounted(e.sale_status)) cur.ca += Number(e.amount_ht) || 0;
      if (hoursCounted(e.sale_status)) cur.hours += Number(e.hours) || 0;
    } else if (e.kind === "charge" && !e.is_investment) {
      cur.charges += Number(e.amount_ht) || 0;
    }
    agg.set(key, cur);
  }

  const clientRows: CeevLiveClient[] = Array.from(agg.entries()).map(([clientId, a]) => {
    const margin = a.ca - a.charges;
    const tauxHoraire = a.hours > 0 ? a.ca / a.hours : null;

    let classe: CeevLiveClass = "non_classe";
    let why = "CA ou heures insuffisants pour juger la rentabilité de ce contrat cette année.";
    if (
      a.hours >= thresholds.heuresMinClient &&
      a.ca > 0 &&
      targetHourlyRate > 0 &&
      tauxHoraire != null
    ) {
      if (tauxHoraire >= targetHourlyRate * thresholds.clientTresRentableRatio) {
        classe = "tres_rentable";
        why = `Taux horaire ${tauxHoraire.toFixed(0)} €/h ≥ ${(thresholds.clientTresRentableRatio * 100).toFixed(0)} % de la cible (${targetHourlyRate} €/h).`;
      } else if (tauxHoraire >= targetHourlyRate) {
        classe = "rentable";
        why = `Taux horaire ${tauxHoraire.toFixed(0)} €/h au-dessus de la cible (${targetHourlyRate} €/h).`;
      } else if (tauxHoraire >= targetHourlyRate * thresholds.clientSurveillerRatio) {
        classe = "a_surveiller";
        why = `Taux horaire ${tauxHoraire.toFixed(0)} €/h légèrement sous la cible (${targetHourlyRate} €/h).`;
      } else {
        classe = "chronophage";
        why = `Taux horaire ${tauxHoraire.toFixed(0)} €/h très en dessous de la cible sur ${a.hours.toFixed(1)} h.`;
      }
    }

    return {
      clientId,
      clientName: clientNameById.get(clientId) ?? "Client",
      ca: a.ca,
      charges: a.charges,
      margin,
      hours: a.hours,
      tauxHoraire,
      classe,
      why,
    };
  });

  clientRows.sort((a, b) => b.ca - a.ca);

  const totals = clientRows.reduce(
    (acc, c) => ({
      ca: acc.ca + c.ca,
      charges: acc.charges + c.charges,
      margin: acc.margin + c.margin,
      hours: acc.hours + c.hours,
    }),
    { ca: 0, charges: 0, margin: 0, hours: 0 },
  );

  return { year, targetHourlyRate, clients: clientRows, totals };
}

/** Clients CEEV présents une année donnée mais absents l'année suivante (signal de non-reconduction à vérifier). */
export function clientsNotCarriedOver(
  previous: CeevLiveClient[],
  current: CeevLiveClient[],
): CeevLiveClient[] {
  const currentIds = new Set(current.map((c) => c.clientId));
  return previous.filter((c) => !currentIds.has(c.clientId));
}
