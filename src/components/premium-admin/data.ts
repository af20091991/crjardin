import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listClients, type Client } from "@/lib/clients";
import type { PremiumPlanningDb } from "@/lib/premium-planning-import.server";
import {
  listPremiumCalendarItemsForClients,
  type PremiumWorkCalendarItem,
} from "@/lib/client-premium";
import { computePremiumAlerts, type PremiumAlert } from "@/lib/premium-admin-health";
import type { PremiumContact } from "@/components/premium-admin/shared";

export type PremiumStatus = {
  client_id: string;
  enabled: boolean;
  activated_at: string | null;
  updated_at: string | null;
  cover_photo_id: string | null;
};

export type PremiumMessage = {
  id: string;
  client_id: string;
  intervention_id: string | null;
  kind: string;
  content: string;
  author_name: string | null;
  sender: string;
  resolved: boolean;
  created_at: string;
};

export type PremiumDocumentRow = {
  id: string;
  client_id: string;
  title: string;
  filename: string;
  storage_path: string;
  uploaded_by: "gardener" | "client";
  created_at: string;
  visible_to_client: boolean;
};

export type PremiumDocumentView = {
  id: string;
  client_viewed_at: string | null;
  client_view_count: number;
};

export type PremiumAccess = { client_id: string; accessed_at: string };

export type PremiumRecommendation = {
  id: string;
  client_id: string;
  title: string;
  client_interest: string | null;
  client_interest_at: string | null;
};

export type PremiumIntervention = {
  id: string;
  client_id: string;
  title: string | null;
  intervention_type: string | null;
  intervention_date: string;
  sent_to_client_at: string | null;
  client_read_at: string | null;
};

export type PremiumRow = {
  premium: PremiumStatus;
  client: Client;
  contact?: PremiumContact;
  calendar: PremiumWorkCalendarItem[];
  lastReportSentAt: string | null;
  lastAccess: string | null;
  pendingMessages: number;
  clientDocuments: number;
  alerts: PremiumAlert[];
};

function fail(label: string, error: { message: string }): never {
  throw new Error(`${label} : ${error.message}`);
}

export function usePremiumAdminData(enabled: boolean) {
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: listClients, enabled });

  const premiumQuery = useQuery({
    queryKey: ["client-premium-enabled"],
    enabled,
    queryFn: async (): Promise<PremiumStatus[]> => {
      const { data, error } = await supabase
        .from("client_premium")
        .select("client_id, enabled, activated_at, updated_at, cover_photo_id")
        .eq("enabled", true)
        .order("activated_at", { ascending: false });
      if (error) fail("Impossible de charger les comptes Premium", error);
      return (data ?? []) as PremiumStatus[];
    },
  });

  const premiumIdsKey = (premiumQuery.data ?? []).map((row) => row.client_id);
  const hasPremium = premiumIdsKey.length > 0;

  const contactsQuery = useQuery({
    queryKey: ["premium-client-contacts", premiumIdsKey],
    enabled: enabled && hasPremium,
    queryFn: async (): Promise<PremiumContact[]> => {
      const { data, error } = await supabase
        .from("contacts")
        .select("client_id, first_name, last_name, is_report_recipient, updated_at")
        .in("client_id", premiumIdsKey)
        .order("is_report_recipient", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) fail("Impossible de charger les identités Premium", error);
      const seen = new Set<string>();
      return ((data ?? []) as PremiumContact[]).filter((contact) => {
        if (seen.has(contact.client_id)) return false;
        seen.add(contact.client_id);
        return true;
      });
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["premium-admin-messages"],
    enabled,
    queryFn: async (): Promise<PremiumMessage[]> => {
      const { data, error } = await supabase
        .from("client_messages")
        .select(
          "id, client_id, intervention_id, kind, content, author_name, sender, resolved, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) fail("Impossible de charger les demandes Premium", error);
      return (data ?? []) as PremiumMessage[];
    },
  });

  const documentsQuery = useQuery({
    queryKey: ["premium-admin-documents"],
    enabled,
    queryFn: async (): Promise<PremiumDocumentRow[]> => {
      const { data, error } = await supabase
        .from("client_premium_documents")
        .select(
          "id, client_id, title, filename, storage_path, uploaded_by, created_at, visible_to_client",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) fail("Impossible de charger les documents Premium", error);
      return (data ?? []) as PremiumDocumentRow[];
    },
  });

  // Suivi des vues : requête séparée et tolérante, pour ne jamais bloquer la page.
  const documentViewsQuery = useQuery({
    queryKey: ["premium-admin-document-views"],
    enabled,
    queryFn: async (): Promise<PremiumDocumentView[]> => {
      const { data, error } = await (supabase as unknown as PremiumPlanningDb)
        .from("client_premium_documents")
        .select("id, client_viewed_at, client_view_count");
      if (error) return [];
      return (data ?? []) as PremiumDocumentView[];
    },
  });

  const accessQuery = useQuery({
    queryKey: ["premium-admin-access"],
    enabled,
    queryFn: async (): Promise<PremiumAccess[]> => {
      const { data, error } = await supabase
        .from("share_access_log")
        .select("client_id, accessed_at")
        .order("accessed_at", { ascending: false })
        .limit(500);
      if (error) fail("Impossible de charger les consultations Premium", error);
      return (data ?? []) as PremiumAccess[];
    },
  });

  const recommendationsQuery = useQuery({
    queryKey: ["premium-admin-recommendations"],
    enabled,
    queryFn: async (): Promise<PremiumRecommendation[]> => {
      const { data, error } = await supabase
        .from("recommendations")
        .select("id, client_id, title, client_interest, client_interest_at")
        .not("client_interest", "is", null)
        .order("client_interest_at", { ascending: false })
        .limit(100);
      if (error) fail("Impossible de charger les retours de préconisations", error);
      return (data ?? []) as PremiumRecommendation[];
    },
  });

  const interventionsQuery = useQuery({
    queryKey: ["premium-admin-interventions", premiumIdsKey],
    enabled: enabled && hasPremium,
    queryFn: async (): Promise<PremiumIntervention[]> => {
      const { data, error } = await supabase
        .from("interventions")
        .select(
          "id, client_id, title, intervention_type, intervention_date, sent_to_client_at, client_read_at",
        )
        .in("client_id", premiumIdsKey)
        .not("sent_to_client_at", "is", null)
        .order("sent_to_client_at", { ascending: false });
      if (error) fail("Impossible de charger les comptes-rendus envoyés", error);
      return (data ?? []) as PremiumIntervention[];
    },
  });

  const calendarQuery = useQuery({
    queryKey: ["premium-admin-calendars", premiumIdsKey],
    enabled: enabled && hasPremium,
    queryFn: () => listPremiumCalendarItemsForClients(premiumIdsKey),
  });

  const clientsById = useMemo(
    () => new Map((clientsQuery.data ?? []).map((client) => [client.id, client])),
    [clientsQuery.data],
  );
  const contactsByClient = useMemo(
    () => new Map((contactsQuery.data ?? []).map((contact) => [contact.client_id, contact])),
    [contactsQuery.data],
  );

  const rows = useMemo<PremiumRow[]>(() => {
    const result: PremiumRow[] = [];
    for (const premium of premiumQuery.data ?? []) {
      const client = clientsById.get(premium.client_id);
      if (!client || client.contract_type !== "Entretien annuel") continue;
      const calendar = (calendarQuery.data ?? []).filter((item) => item.client_id === client.id);
      const reports = (interventionsQuery.data ?? []).filter((iv) => iv.client_id === client.id);
      const lastReportSentAt = reports.reduce<string | null>(
        (latest, iv) =>
          iv.sent_to_client_at && (!latest || iv.sent_to_client_at > latest)
            ? iv.sent_to_client_at
            : latest,
        null,
      );
      const lastAccess = (accessQuery.data ?? [])
        .filter((access) => access.client_id === client.id)
        .reduce<
          string | null
        >((latest, access) => (!latest || access.accessed_at > latest ? access.accessed_at : latest), null);
      result.push({
        premium,
        client,
        contact: contactsByClient.get(client.id),
        calendar,
        lastReportSentAt,
        lastAccess,
        pendingMessages: (messagesQuery.data ?? []).filter(
          (m) => m.client_id === client.id && !m.resolved && m.sender === "client",
        ).length,
        clientDocuments: (documentsQuery.data ?? []).filter(
          (d) => d.client_id === client.id && d.uploaded_by === "client",
        ).length,
        alerts: computePremiumAlerts({
          calendar,
          coverPhotoId: premium.cover_photo_id,
          lastReportSentAt,
        }),
      });
    }
    return result.sort((a, b) => a.client.name.localeCompare(b.client.name, "fr"));
  }, [
    premiumQuery.data,
    clientsById,
    calendarQuery.data,
    interventionsQuery.data,
    accessQuery.data,
    contactsByClient,
    messagesQuery.data,
    documentsQuery.data,
  ]);

  const premiumIds = useMemo(() => new Set(rows.map((row) => row.client.id)), [rows]);

  const queries = [
    clientsQuery,
    premiumQuery,
    contactsQuery,
    messagesQuery,
    documentsQuery,
    accessQuery,
    recommendationsQuery,
    interventionsQuery,
    calendarQuery,
  ];

  return {
    rows,
    premiumIds,
    clientsById,
    contactsByClient,
    messages: (messagesQuery.data ?? []).filter((m) => premiumIds.has(m.client_id)),
    documents: (documentsQuery.data ?? []).filter((d) => premiumIds.has(d.client_id)),
    documentViews: documentViewsQuery.data ?? [],
    access: (accessQuery.data ?? []).filter((a) => premiumIds.has(a.client_id)),
    recommendations: (recommendationsQuery.data ?? []).filter((r) => premiumIds.has(r.client_id)),
    sentReports: (interventionsQuery.data ?? []).filter((iv) => premiumIds.has(iv.client_id)),
    isLoading: queries.some((query) => query.isLoading),
    error: queries.find((query) => query.error)?.error ?? null,
  };
}
