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

type ImportField =
  | Exclude<
      keyof ClientInput,
      "emails" | "report_policy" | "source" | "source_confidence" | "lifecycle_status" | "lost_at"
    >
  | "first_name"
  | "last_name";

// Map of normalised header aliases → import field. First/last name are kept
// separate so Excel files with "Prénom" + "Nom" are combined reliably.
const FIELD_ALIASES: Record<ImportField, string[]> = {
  name: ["nomcomplet", "nomprenom", "nometprenom", "nomduclient", "nomclient", "client", "contact", "proprietaire", "raisonsociale", "name"],
  first_name: ["prenom", "firstname", "givenname", "forename"],
  last_name: ["nom", "nomdefamille", "nomfamille", "nomusage", "lastname", "surname", "familyname"],
  civility: ["civilite", "civility", "titre", "genre", "qualite"],
  client_type: ["typedeclient", "typeclient", "clienttype", "type", "categorie", "segment", "statutclient"],
  address: ["adresse", "address", "adressepostale", "adressecomplete", "rue", "voie"],
  phone: ["telephone", "tel", "phone", "mobile", "portable", "numero", "numerodetelephone"],
  email: ["email", "mail", "courriel", "adresseemail", "adressemail", "emailaddress"],
  contract_type: ["typedecontrat", "contrat", "typecontrat", "contracttype"],
  frequency: ["frequence", "frequency", "rythme"],
  notes: ["notes", "observations", "remarques", "commentaires", "note"],
};

const FIELD_PRIORITY: ImportField[] = [
  "email",
  "phone",
  "civility",
  "last_name",
  "first_name",
  "name",
  "contract_type",
  "client_type",
  "frequency",
  "notes",
  "address",
];

function headerScore(field: ImportField, headerNorm: string): number {
  if (field === "address" && /(mail|email|courriel|nom|prenom|telephone|tel|phone|mobile|civilite)/.test(headerNorm)) return 0;
  if ((field === "name" || field === "last_name" || field === "first_name") && /(adresse|address|mail|email|telephone|tel|phone|mobile)/.test(headerNorm)) return 0;
  if (field === "email" && /(telephone|tel|phone|mobile)/.test(headerNorm)) return 0;
  if (field === "phone" && /(mail|email|courriel|adresseemail|adressemail)/.test(headerNorm)) return 0;

  let best = 0;
  for (const alias of FIELD_ALIASES[field]) {
    if (headerNorm === alias) best = Math.max(best, 100);
    else if (alias.length >= 4 && headerNorm.startsWith(alias)) best = Math.max(best, 82);
    else if (alias.length >= 5 && headerNorm.includes(alias)) best = Math.max(best, 62);
  }
  return best;
}

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
  const colMap: Partial<Record<ImportField, string>> = {};
  const normHeaders = headers.map((h) => ({ header: h, n: norm(h) }));
  const usedHeaders = new Set<string>();
  for (const field of FIELD_PRIORITY) {
    const match = normHeaders
      .filter((h) => !usedHeaders.has(h.header))
      .map((h) => ({ ...h, score: headerScore(field, h.n) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score || a.header.length - b.header.length)[0];
    if (match) {
      colMap[field] = match.header;
      usedHeaders.add(match.header);
    }
  }

  const out: ParsedClient[] = [];
  rows.forEach((row, i) => {
    const get = (field: ImportField) =>
      colMap[field] ? String(row[colMap[field]!] ?? "").trim() : "";

    const fullName = get("name");
    const name = fullName || [get("last_name"), get("first_name")].filter(Boolean).join(" ").trim();
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
      client_type: detectClientType(get("client_type")),
      frequency: get("frequency"),
      notes: get("notes"),
    });
  });
  return out;
}
