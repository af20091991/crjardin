import type { ChargeRow } from "@/lib/pilot-charges";
import type { PilotEntry } from "@/lib/pilot";

export interface ClientBenefit {
  key: string;
  name: string;
  ca: number;
  charges: number;
  benefit: number;
  hours: number;
  count: number;
}

function uniqueClientMap(entries: PilotEntry[], field: "site_id" | "intervention_id") {
  const candidates = new Map<string, Set<string>>();
  for (const entry of entries) {
    const reference = entry[field];
    if (!reference || !entry.client_id) continue;
    const ids = candidates.get(reference) ?? new Set<string>();
    ids.add(entry.client_id);
    candidates.set(reference, ids);
  }
  return new Map(
    [...candidates.entries()]
      .filter(([, ids]) => ids.size === 1)
      .map(([reference, ids]) => [reference, [...ids][0]] as const),
  );
}

/** CA réel moins charges d'exploitation explicitement rattachées au client/chantier. */
export function rankClientsByBenefit(
  entries: PilotEntry[],
  charges: ChargeRow[],
  year: number,
  month?: number,
): ClientBenefit[] {
  const scopedEntries = entries.filter((entry) => {
    const date = new Date(entry.entry_date);
    return (
      Number.isFinite(date.getTime()) &&
      date.getFullYear() === year &&
      (month == null || date.getMonth() + 1 === month) &&
      Boolean(entry.client_id) &&
      entry.amount_ht > 0
    );
  });
  const bySite = uniqueClientMap(scopedEntries, "site_id");
  const byIntervention = uniqueClientMap(scopedEntries, "intervention_id");
  const clients = new Map<string, ClientBenefit>();

  for (const entry of scopedEntries) {
    const clientId = entry.client_id;
    if (!clientId) continue;
    const current = clients.get(clientId) ?? {
      key: clientId,
      name: entry.client_name ?? "Client",
      ca: 0,
      charges: 0,
      benefit: 0,
      hours: 0,
      count: 0,
    };
    current.ca += entry.amount_ht;
    current.hours += entry.hours;
    current.count += 1;
    if (entry.client_name) current.name = entry.client_name;
    clients.set(clientId, current);
  }

  for (const charge of charges) {
    if (
      charge.kind !== "charge" ||
      charge.is_investment ||
      charge.year !== year ||
      (month != null && charge.month !== month)
    ) continue;
    const clientId =
      charge.client_id ??
      (charge.intervention_id ? byIntervention.get(charge.intervention_id) : undefined) ??
      (charge.site_id ? bySite.get(charge.site_id) : undefined);
    const client = clientId ? clients.get(clientId) : undefined;
    if (client) client.charges += charge.amount_ht;
  }

  return [...clients.values()]
    .map((client) => ({ ...client, benefit: client.ca - client.charges }))
    .sort((a, b) => b.benefit - a.benefit || b.ca - a.ca)
    .slice(0, 3);
}