/**
 * Instantané chiffré de Pilot Pro fourni à ADPP.
 * Lecture seule : aucune écriture, aucune valeur inventée.
 * Règles respectées : heures = colonne Vente → Temps (pilot_ca_entries.hours),
 * charges lues uniquement dans pilot_ca_entries (kind = "charge").
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupabase = Pick<SupabaseClient, "from">;

const fmt = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

type CaRow = {
  year: number;
  month: number;
  kind: string;
  designation: string | null;
  category: string | null;
  amount_ht: number;
  hours: number | null;
};

export async function buildPilotSnapshot(supabase: AnySupabase): Promise<string> {
  const year = new Date().getFullYear();

  const [caRes, settingsRes, clientsRes, intRes] = await Promise.all([
    supabase
      .from("pilot_ca_entries")
      .select("year,month,kind,designation,category,amount_ht,hours")
      .gte("year", year - 1),
    supabase.from("pilot_settings").select("*").maybeSingle(),
    supabase.from("clients").select("name,contract_type,frequency,entity_status"),
    supabase
      .from("interventions")
      .select("intervention_date,intervention_type,summary")
      .gte("intervention_date", `${year}-01-01`)
      .order("intervention_date", { ascending: false })
      .limit(30),
  ]);

  const queryErrors = [
    ["CA", caRes.error],
    ["paramètres", settingsRes.error],
    ["clients", clientsRes.error],
    ["interventions", intRes.error],
  ].filter(([, error]) => error);

  if (queryErrors.length > 0) {
    const details = queryErrors
      .map(([label, error]) => `${label}: ${error?.message ?? "erreur de lecture"}`)
      .join(" ; ");
    throw new Error(`Données Pilot Pro indisponibles (${details}). Aucun chiffre ne doit être déduit.`);
  }

  const rows = (caRes.data ?? []) as unknown as CaRow[];
  const ventes = rows.filter((row) => row.kind === "vente");
  const charges = rows.filter((row) => row.kind === "charge");
  const sum = (list: CaRow[]) => list.reduce((total, row) => total + Number(row.amount_ht || 0), 0);

  const caYear = sum(ventes.filter((row) => row.year === year));
  const caPrev = sum(ventes.filter((row) => row.year === year - 1));
  const chargesYear = sum(charges.filter((row) => row.year === year));
  const hoursYear = ventes
    .filter((row) => row.year === year)
    .reduce((total, row) => total + Number(row.hours || 0), 0);

  const byCategory: Record<string, number> = {};
  for (const row of ventes.filter((item) => item.year === year)) {
    const key = row.category ?? "Autre";
    byCategory[key] = (byCategory[key] ?? 0) + Number(row.amount_ht || 0);
  }

  const monthLabels = [
    "Janv.",
    "Févr.",
    "Mars",
    "Avr.",
    "Mai",
    "Juin",
    "Juil.",
    "Août",
    "Sept.",
    "Oct.",
    "Nov.",
    "Déc.",
  ];
  const monthLimit = new Date().getMonth() + 1;
  const monthly = (list: CaRow[], targetYear: number, upTo: number) =>
    monthLabels
      .slice(0, upTo)
      .map(
        (label, index) =>
          `${label} ${Math.round(sum(list.filter((row) => row.year === targetYear && Number(row.month) === index + 1)))}`,
      )
      .join(", ");

  const clients = (clientsRes.data ?? []) as unknown as Array<{
    name: string;
    contract_type: string | null;
    frequency: string | null;
    entity_status: string | null;
  }>;
  const interventions = (intRes.data ?? []) as unknown as Array<{
    intervention_date: string;
    intervention_type: string | null;
    summary: string | null;
  }>;
  const settings = settingsRes.data as {
    target_tjm?: number;
    target_hourly_rate?: number;
    monthly_salary?: number;
    weekly_hours?: number;
    monthly_fixed_charges?: number;
  } | null;

  const hourlyRate = hoursYear > 0 ? caYear / hoursYear : null;

  return `INSTANTANÉ PILOT PRO au ${new Date().toLocaleDateString("fr-FR")}

EXERCICE ${year}
- CA HT (ventes saisies) : ${fmt(caYear)} — N-1 : ${fmt(caPrev)}
- Charges HT : ${fmt(chargesYear)}
- Bénéfice (CA − Charges) : ${fmt(caYear - chargesYear)}
- Temps interne (Vente → Temps) : ${hoursYear.toFixed(0)} h
- Taux horaire réel (CA total ÷ temps interne) : ${hourlyRate === null ? "données insuffisantes" : `${hourlyRate.toFixed(0)} €/h`}
- Nombre de lignes de vente (= interventions économiques) : ${ventes.filter((row) => row.year === year).length}
- Répartition par nature : ${
    Object.entries(byCategory)
      .map(([key, value]) => `${key} ${fmt(value)}`)
      .join(", ") || "aucune donnée"
  }

SÉRIES MENSUELLES (mois écoulés uniquement, € HT)
- CA ${year} : ${monthly(ventes, year, monthLimit) || "aucune donnée"}
- CA ${year - 1} : ${monthly(ventes, year - 1, 12) || "aucune donnée"}
- Charges ${year} : ${monthly(charges, year, monthLimit) || "aucune donnée"}

PARAMÈTRES
- TJM cible : ${settings?.target_tjm ?? "non renseigné"} € · Taux horaire cible : ${settings?.target_hourly_rate ?? "non renseigné"} €/h
- Salaire mensuel visé : ${settings?.monthly_salary ?? "non renseigné"} € · Heures/semaine : ${settings?.weekly_hours ?? "non renseigné"}
- Charges fixes mensuelles : ${settings?.monthly_fixed_charges ?? "non renseigné"} €

CLIENTS (${clients.length})
${
  clients
    .slice(0, 40)
    .map(
      (client) =>
        `- ${client.name} — ${client.contract_type ?? "sans contrat"}${client.frequency ? ` (${client.frequency})` : ""}${client.entity_status ? ` [${client.entity_status}]` : ""}`,
    )
    .join("\n") || "aucun client"
}

INTERVENTIONS RÉCENTES (${interventions.length})
${
  interventions
    .slice(0, 15)
    .map(
      (item) =>
        `- ${item.intervention_date} : ${item.intervention_type ?? "Entretien"}${item.summary ? ` — ${item.summary.slice(0, 70)}` : ""}`,
    )
    .join("\n") || "aucune intervention"
}

RAPPEL : avant ${year} le Temps n'était pas suivi — une absence d'heures sur l'historique n'est jamais une anomalie.`;
}
