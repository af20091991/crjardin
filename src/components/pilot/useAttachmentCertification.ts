// Lecture partagée de la certification des rattachements CA → client.
// Aucun calcul métier ici : le hook branche les sources existantes
// (pilot_ca_entries de type vente, clients, audit du référentiel) sur le
// moteur `src/lib/pilot-attachment-certification.ts`.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAllCaRows } from "@/lib/pilot-ca-fetch";
import { supabase } from "@/integrations/supabase/client";
import { usePilotScope } from "@/lib/pilot-mode";
import { keepRealizedYearMonth } from "@/lib/pilot-realized";
import { PERIOD_LABELS } from "@/lib/pilot-realized";
import { runReferentialAudit } from "@/lib/pilot-referential";
import {
  buildAttachmentCertification,
  type AttachmentCertificationReport,
  type CertificationClient,
} from "@/lib/pilot-attachment-certification";

interface SaleRow {
  id: string;
  client_id: string | null;
  designation: string | null;
  amount_ht: number | null;
  year: number;
  month: number;
  entry_date?: string | null;
}

async function fetchSales(year: number): Promise<SaleRow[]> {
  return fetchAllCaRows<SaleRow>("id,client_id,designation,amount_ht,year,month", {
    kind: "vente",
    year,
  });
}

async function fetchClients(): Promise<
  Array<{ id: string; name: string; entity_status: string | null; merged_into_client_id: string | null }>
> {
  const { data, error } = await (supabase as unknown as { from: (t: string) => any })
    .from("clients")
    .select("id,name,entity_status,merged_into_client_id");
  if (error) throw error;
  return (data ?? []) as any[];
}

export function useAttachmentCertification(): {
  report: AttachmentCertificationReport | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { year, period } = usePilotScope();
  const sales = useQuery({ queryKey: ["certif-sales", year], queryFn: () => fetchSales(year) });
  const clients = useQuery({ queryKey: ["certif-clients"], queryFn: fetchClients });
  // Doublons : lecture seule de l'audit du référentiel (aucune fusion).
  const audit = useQuery({ queryKey: ["referential-audit"], queryFn: runReferentialAudit });

  const report = useMemo(() => {
    if (!sales.data || !clients.data) return null;
    const dupByClient = new Map<string, string[]>(
      (audit.data?.rows ?? []).map((r) => [r.client_id, r.duplicateOf.map((d) => d.name)]),
    );
    const list: CertificationClient[] = clients.data.map((c) => ({
      id: c.id,
      name: c.name,
      entity_status: c.entity_status,
      merged_into_client_id: c.merged_into_client_id,
      duplicateNames: dupByClient.get(c.id) ?? [],
    }));
    const scoped = sales.data.filter((s) =>
      keepRealizedYearMonth({ year: s.year, month: s.month }, { period }),
    );
    return buildAttachmentCertification({
      periode: `${year} — ${PERIOD_LABELS[period]}`,
      sales: scoped.map((s) => ({
        id: s.id,
        client_id: s.client_id,
        designation: s.designation,
        amount_ht: s.amount_ht,
      })),
      clients: list,
    });
  }, [sales.data, clients.data, audit.data, period, year]);

  const err = (sales.error ?? clients.error) as Error | null;

  return {
    report,
    isLoading: sales.isLoading || clients.isLoading,
    error: err ? err.message : null,
    refetch: () => {
      void sales.refetch();
      void clients.refetch();
      void audit.refetch();
    },
  };
}