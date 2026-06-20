import * as XLSX from "xlsx";
import type { ClientInput } from "@/lib/clients";

const CIVILITIES = ["Madame", "Monsieur", "Madame et Monsieur"];

// Normalise a header label for matching (lowercase, no accents, no spaces/punct)
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Map of normalised header aliases → ClientInput field
const FIELD_ALIASES: Record<keyof ClientInput, string[]> = {
  name: ["nom", "nomclient", "client", "name", "nomdefamille", "raisonsociale"],
  civility: ["civilite", "civility", "titre", "genre"],
  address: ["adresse", "address", "adressepostale", "rue"],
  phone: ["telephone", "tel", "phone", "mobile", "portable", "numero", "numerodetelephone"],
  email: ["email", "mail", "courriel", "adresseemail", "adressemail", "emailaddress"],
  contract_type: ["typedecontrat", "contrat", "typecontrat", "contracttype"],
  frequency: ["frequence", "frequency", "rythme"],
  notes: ["notes", "observations", "remarques", "commentaires", "note"],
};

function detectCivility(value: string): string {
  const v = norm(value);
  if (v.includes("mretmme") || (v.includes("monsieur") && v.includes("madame")) || v === "mrmme")
    return "Madame et Monsieur";
  if (v.startsWith("mme") || v.includes("madame")) return "Madame";
  if (v.startsWith("mr") || v.startsWith("m") || v.includes("monsieur")) return "Monsieur";
  return CIVILITIES.includes(value) ? value : "";
}

// Normalise a French phone number into a readable international-friendly format.
// Never throws — returns the raw trimmed value if it can't be parsed.
export function formatPhone(raw: string): string {
  const trimmed = (raw ?? "").toString().trim();
  if (!trimmed) return "";
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  // French local number 0X XX XX XX XX → +33 X ...
  if (/^0\d{9}$/.test(digits)) {
    const rest = digits.slice(1);
    return `+33 ${rest[0]} ${rest.slice(1).replace(/(\d{2})(?=\d)/g, "$1 ").trim()}`;
  }
  return trimmed;
}

export interface ParsedClient extends ClientInput {
  _row: number;
}

export async function parseClientsFile(file: File): Promise<ParsedClient[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!rows.length) return [];

  // Build header → field mapping from the first row's keys
  const headers = Object.keys(rows[0]);
  const colMap: Partial<Record<keyof ClientInput, string>> = {};
  const normHeaders = headers.map((h) => ({ header: h, n: norm(h) }));
  const usedHeaders = new Set<string>();
  const fields = Object.keys(FIELD_ALIASES) as (keyof ClientInput)[];

  // Pass 1 — exact alias matches only. These are unambiguous, so resolving
  // them first prevents a generic substring (e.g. "adresse" inside
  // "adresse e-mail") from stealing a column from a more specific field.
  for (const field of fields) {
    const match = normHeaders.find(
      (h) => !usedHeaders.has(h.header) && FIELD_ALIASES[field].includes(h.n),
    );
    if (match) {
      colMap[field] = match.header;
      usedHeaders.add(match.header);
    }
  }

  // Pass 2 — fallback to a substring match for any field still unmapped.
  // Only allow the header to CONTAIN an alias (never the reverse) and require
  // a reasonably long alias to avoid false positives like "m" or "tel".
  for (const field of fields) {
    if (colMap[field]) continue;
    const match = normHeaders.find(
      (h) =>
        !usedHeaders.has(h.header) &&
        FIELD_ALIASES[field].some((a) => a.length >= 4 && h.n.includes(a)),
    );
    if (match) {
      colMap[field] = match.header;
      usedHeaders.add(match.header);
    }
  }

  const out: ParsedClient[] = [];
  rows.forEach((row, i) => {
    const get = (field: keyof ClientInput) =>
      colMap[field] ? String(row[colMap[field]!] ?? "").trim() : "";

    const name = get("name");
    const phoneRaw = get("phone");
    const civRaw = get("civility");
    // Only keep rows that carry at least a name or some contact info
    if (!name && !phoneRaw && !get("email")) return;

    out.push({
      _row: i + 2, // +2 = header row + 1-based
      name,
      civility: detectCivility(civRaw),
      address: get("address"),
      phone: phoneRaw ? formatPhone(phoneRaw) : "",
      email: get("email"),
      contract_type: get("contract_type"),
      frequency: get("frequency"),
      notes: get("notes"),
    });
  });
  return out;
}
