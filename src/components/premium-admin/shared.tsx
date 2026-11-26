import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Client } from "@/lib/clients";
import { formatPremiumClientName } from "@/lib/premium-client-name";

export type PremiumContact = {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
};

export function displayClientName(client: Client, contact?: PremiumContact) {
  return formatPremiumClientName({
    name: client.name,
    civility: client.civility,
    firstName: contact?.first_name,
    lastName: contact?.last_name,
  });
}

export function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function fmtDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminStat({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card className={`p-5 ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </div>
    </Card>
  );
}

export function AdminListCard({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: LucideIcon;
  empty: string;
  children: ReactNode;
}) {
  const hasContent = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="font-serif text-xl">{title}</h2>
      </div>
      <div className="space-y-3 p-4">
        {hasContent ? children : <p className="p-3 text-sm text-muted-foreground">{empty}</p>}
      </div>
    </Card>
  );
}
