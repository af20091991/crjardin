// ---------------------------------------------------------------------------
// Certification des RATTACHEMENTS CA → client (données réelles).
//
// Question posée : « pourquoi une vente n'est-elle pas certifiée ? »
// Ce moteur ne recalcule aucun CA, ne déplace aucune ligne et n'écrit rien.
// Il classe chaque ligne de vente du périmètre déjà retenu par les écrans
// (exercice + arrêt à date) en un motif unique et démontrable, puis agrège
// par client pour indiquer ce qui est certifiable en l'état.
//
// Règles absolues :
// - jamais de rattachement déduit d'une simple ressemblance de nom si
//   plusieurs clients sont possibles ;
// - jamais de client ni d'identifiant inventé ;
// - jamais de fusion automatique de deux fiches.
// ---------------------------------------------------------------------------
import { normalizeName, similarity } from "@/lib/pilot-referential";
import { clientNameFromDesignation } from "@/lib/pilot-ca-designation";
import type { IntegrityStatus } from "@/lib/pilot-integrity";

/** Seuil de reconnaissance d'un nom (identique aux règles du référentiel). */
export const NAME_MATCH_THRESHOLD = 0.7;
/** Seuil au-delà duquel un autre client devient un candidat concurrent. */
export const NAME_AMBIGUITY_THRESHOLD = 0.85;

export type AttachmentVerdict =
  | "rattachement_certifie"
  | "rattachement_demontrable"
  | "client_absent"
  | "client_ambigu"
  | "doublon_client"
  | "nom_non_rapproche"
  | "reference_invalide"
  | "donnee_incomplete"
  | "autre_anomalie";

export const VERDICT_META: Record<
  AttachmentVerdict,
  { label: string; status: IntegrityStatus; hint: string }
> = {
  rattachement_certifie: {
    label: "Rattachement certifié",
    status: "certifie",
    hint: "Fiche certifiée humainement et nom cohérent avec la désignation facturée.",
    },
  rattachement_demontrable: {
    label: "Certifiable en l'état",
    status: "incomplet",
    hint: "Rattachement unique et démontrable : seule la validation humaine de la fiche manque.",
  },
  client_absent: {
    label: "Client absent",
    status: "indisponible",
    hint: "La ligne de vente ne porte aucun client : rattachement impossible sans décision humaine.",
  },
  client_ambigu: {
    label: "Client ambigu",
    status: "suspect",
    hint: "Plusieurs fiches peuvent correspondre à la désignation : aucun rattachement ne peut être déduit.",
  },
  doublon_client: {
    label: "Doublon client",
    status: "suspect",
    hint: "La fiche rattachée est un doublon possible (ou fusionnée) : à trancher avant certification.",
  },
  nom_non_rapproche: {
    label: "Nom non rapproché",
    status: "suspect",
    hint: "La désignation facturée ne correspond pas au nom de la fiche rattachée.",
  },
  reference_invalide: {
    label: "Référence invalide",
    status: "indisponible",
    hint: "L'identifiant client de la ligne ne correspond à aucune fiche existante.",
  },
  donnee_incomplete: {
    label: "Donnée incomplète",
    status: "incomplet",
    hint: "Montant ou désignation manquant : le rattachement n'est pas vérifiable.",
  },
  autre_anomalie: {
    label: "Autre anomalie",
    status: "suspect",
    hint: "Situation non couverte par les motifs connus : examen manuel requis.",
  },
};

export interface CertificationSale {
  id: string;
  client_id: string | null;
  designation: string | null;
  amount_ht: number | null;
}

export interface CertificationClient {
  id: string;
  name: string;
  entity_status: string | null;
  merged_into_client_id?: string | null;
  /** Fiches jugées proches par l'audit du référentiel (lecture seule). */
  duplicateNames?: string[];
}

export interface SaleVerdict {
  saleId: string;
  clientId: string | null;
  clientName: string | null;
  designation: string | null;
  designationName: string | null;
  amountHt: number;
  verdict: AttachmentVerdict;
  status: IntegrityStatus;
  detail: string;
  /** Autres fiches candidates (jamais appliquées automatiquement). */
  candidates: string[];
}

export interface ClientCertification {
  clientId: string;
  clientName: string;
  entityStatus: string | null;
  lines: number;
  amountHt: number;
  status: IntegrityStatus;
  /** Vrai uniquement si TOUTES les lignes du client sont démontrables. */
  certifiable: boolean;
  verdicts: Record<string, number>;
  blockers: string[];
}

export interface AttachmentCertificationReport {
  periode: string;
  status: IntegrityStatus;
  message: string;
  totalLines: number;
  totalAmount: number;
  certifiedLines: number;
  certifiedAmount: number;
  certifiableLines: number;
  certifiableAmount: number;
  blockedLines: number;
  blockedAmount: number;
  byVerdict: Array<{ verdict: AttachmentVerdict; lines: number; amount: number }>;
  sales: SaleVerdict[];
  clients: ClientCertification[];
}

const VERDICT_ORDER: AttachmentVerdict[] = [
  "rattachement_certifie",
  "rattachement_demontrable",
  "donnee_incomplete",
  "nom_non_rapproche",
  "client_ambigu",
  "doublon_client",
  "client_absent",
  "reference_invalide",
  "autre_anomalie",
];

function worst(a: IntegrityStatus, b: IntegrityStatus): IntegrityStatus {
  const rank: Record<IntegrityStatus, number> = {
    certifie: 0,
    incomplet: 1,
    suspect: 2,
    indisponible: 3,
  };
  return rank[a] >= rank[b] ? a : b;
}

/** Classement d'une seule ligne de vente (fonction pure, testable). */
export function classifySale(
  sale: CertificationSale,
  clientsById: Map<string, CertificationClient>,
  clientsByKey: Map<string, CertificationClient[]>,
): SaleVerdict {
  const amountHt = Number(sale.amount_ht) || 0;
  const designationName = clientNameFromDesignation(sale.designation) || null;
  const client = sale.client_id ? clientsById.get(sale.client_id) : undefined;

  const base = {
    saleId: sale.id,
    clientId: sale.client_id ?? null,
    clientName: client?.name ?? null,
    designation: sale.designation ?? null,
    designationName,
    amountHt,
    candidates: [] as string[],
  };

  const out = (verdict: AttachmentVerdict, detail: string, candidates: string[] = []): SaleVerdict => ({
    ...base,
    verdict,
    status: VERDICT_META[verdict].status,
    detail,
    candidates,
  });

  if (!sale.client_id) {
    return out("client_absent", "Aucun client porté par la ligne de vente.");
  }
  if (!client) {
    return out(
      "reference_invalide",
      `L'identifiant client ${sale.client_id} ne correspond à aucune fiche existante.`,
    );
  }
  if (client.merged_into_client_id) {
    return out("doublon_client", `Fiche « ${client.name} » fusionnée dans une autre fiche.`);
  }
  if ((client.duplicateNames ?? []).length > 0) {
    return out(
      "doublon_client",
      `Doublon possible avec ${(client.duplicateNames ?? []).slice(0, 2).join(", ")}.`,
      client.duplicateNames ?? [],
    );
  }
  if (amountHt === 0 || !designationName) {
    return out(
      "donnee_incomplete",
      amountHt === 0 ? "Montant HT absent ou nul." : "Désignation exploitable absente.",
    );
  }

  const key = normalizeName(designationName);
  const attachedScore = similarity(key, normalizeName(client.name));

  // Concurrents : autres fiches dont le nom est très proche de la désignation.
  const competitors = new Set<string>();
  for (const [otherKey, list] of clientsByKey) {
    if (!otherKey) continue;
    if (similarity(key, otherKey) < NAME_AMBIGUITY_THRESHOLD) continue;
    for (const c of list) if (c.id !== client.id) competitors.add(c.name);
  }

  if (attachedScore < NAME_MATCH_THRESHOLD) {
    if (competitors.size > 0) {
      return out(
        "client_ambigu",
        `La désignation « ${designationName} » correspond mieux à d'autres fiches : aucun rattachement déduit.`,
        [...competitors],
      );
    }
    return out(
      "nom_non_rapproche",
      `Désignation « ${designationName} » non rapprochée du nom de fiche « ${client.name} ».`,
    );
  }
  if (competitors.size > 0) {
    return out(
      "client_ambigu",
      `Nom également porté par ${[...competitors].slice(0, 2).join(", ")} : rattachement non unique.`,
      [...competitors],
    );
  }
  if (client.entity_status === "certified_client") {
    return out("rattachement_certifie", "Fiche certifiée et désignation cohérente.");
  }
  return out(
    "rattachement_demontrable",
    "Rattachement unique et cohérent : la fiche reste à certifier humainement.",
  );
}

export function buildAttachmentCertification(input: {
  periode: string;
  sales: readonly CertificationSale[];
  clients: readonly CertificationClient[];
}): AttachmentCertificationReport {
  const clientsById = new Map(input.clients.map((c) => [c.id, c]));
  const clientsByKey = new Map<string, CertificationClient[]>();
  for (const c of input.clients) {
    if (c.merged_into_client_id) continue;
    const k = normalizeName(c.name);
    if (!k) continue;
    const list = clientsByKey.get(k) ?? [];
    list.push(c);
    clientsByKey.set(k, list);
  }

  const sales = input.sales.map((s) => classifySale(s, clientsById, clientsByKey));

  const byVerdict = VERDICT_ORDER.map((verdict) => {
    const list = sales.filter((s) => s.verdict === verdict);
    return { verdict, lines: list.length, amount: list.reduce((t, s) => t + s.amountHt, 0) };
  }).filter((b) => b.lines > 0);

  const clientsMap = new Map<string, ClientCertification>();
  for (const s of sales) {
    if (!s.clientId) continue;
    const row = clientsById.get(s.clientId);
    let agg = clientsMap.get(s.clientId);
    if (!agg) {
      agg = {
        clientId: s.clientId,
        clientName: row?.name ?? s.clientId,
        entityStatus: row?.entity_status ?? null,
        lines: 0,
        amountHt: 0,
        status: "certifie",
        certifiable: true,
        verdicts: {},
        blockers: [],
      };
      clientsMap.set(s.clientId, agg);
    }
    agg.lines += 1;
    agg.amountHt += s.amountHt;
    agg.verdicts[s.verdict] = (agg.verdicts[s.verdict] ?? 0) + 1;
    agg.status = worst(agg.status, s.status);
    if (s.verdict !== "rattachement_certifie" && s.verdict !== "rattachement_demontrable") {
      agg.certifiable = false;
      const detail = `${VERDICT_META[s.verdict].label} — ${s.detail}`;
      if (!agg.blockers.includes(detail)) agg.blockers.push(detail);
    }
  }
  // Une fiche déjà certifiée n'a plus rien à certifier.
  for (const agg of clientsMap.values()) {
    if (agg.entityStatus === "certified_client") agg.certifiable = false;
  }

  const sum = (list: SaleVerdict[]) => list.reduce((t, s) => t + s.amountHt, 0);
  const certified = sales.filter((s) => s.verdict === "rattachement_certifie");
  const certifiable = sales.filter((s) => s.verdict === "rattachement_demontrable");
  const blocked = sales.filter(
    (s) => s.verdict !== "rattachement_certifie" && s.verdict !== "rattachement_demontrable",
  );

  const totalAmount = sum(sales);
  const status: IntegrityStatus = sales.length === 0
    ? "indisponible"
    : blocked.length > 0
      ? blocked.some((s) => s.status === "indisponible")
        ? "indisponible"
        : "suspect"
      : certifiable.length > 0
        ? "incomplet"
        : "certifie";

  const pct = totalAmount > 0 ? Math.round((sum(certified) / totalAmount) * 100) : 0;
  const message = sales.length === 0
    ? "Aucune ligne de vente sur le périmètre : certification des rattachements indisponible."
    : blocked.length === 0 && certifiable.length === 0
      ? `Tous les rattachements sont certifiés (${pct} % du CA du périmètre).`
      : `${pct} % du CA est certifié ; ${certifiable.length} ligne(s) sont certifiables en l'état et ${blocked.length} ligne(s) exigent une décision humaine.`;

  return {
    periode: input.periode,
    status,
    message,
    totalLines: sales.length,
    totalAmount,
    certifiedLines: certified.length,
    certifiedAmount: sum(certified),
    certifiableLines: certifiable.length,
    certifiableAmount: sum(certifiable),
    blockedLines: blocked.length,
    blockedAmount: sum(blocked),
    byVerdict,
    sales,
    clients: [...clientsMap.values()].sort((a, b) => b.amountHt - a.amountHt),
  };
}