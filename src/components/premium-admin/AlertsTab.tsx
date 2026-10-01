import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PremiumRow } from "@/components/premium-admin/data";
import { displayClientName } from "@/components/premium-admin/shared";

export function AlertsTab({
  rows,
  onOpenCalendar,
}: {
  rows: PremiumRow[];
  onOpenCalendar: (clientId: string) => void;
}) {
  const incomplete = rows
    .filter((row) => row.alerts.length > 0)
    .sort(
      (a, b) =>
        b.alerts.filter((alert) => alert.level === "warning").length -
          a.alerts.filter((alert) => alert.level === "warning").length ||
        b.alerts.length - a.alerts.length,
    );

  if (incomplete.length === 0) {
    return (
      <Card className="p-10 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-3 font-serif text-xl">Toutes les fiches Premium sont complètes</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Calendrier, couverture, profil du jardin et comptes-rendus sont à jour.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {incomplete.map((row) => (
        <Card key={row.client.id} className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{displayClientName(row.client, row.contact)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.alerts.length} point{row.alerts.length > 1 ? "s" : ""} à traiter
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 shrink-0 text-primary" />
          </div>
          <ul className="space-y-2">
            {row.alerts.map((alert) => (
              <li
                key={alert.code}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm"
              >
                <span>{alert.label}</span>
                <Badge variant={alert.level === "warning" ? "default" : "secondary"}>
                  {alert.level === "warning" ? "À faire" : "Conseillé"}
                </Badge>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            {row.alerts.some(
              (alert) => alert.code === "no_calendar" || alert.code === "calendar_over",
            ) && (
              <Button size="sm" variant="outline" onClick={() => onOpenCalendar(row.client.id)}>
                Ouvrir le calendrier
              </Button>
            )}
            <Button size="sm" variant="ghost" asChild>
              <Link to="/clients/$clientId" params={{ clientId: row.client.id }}>
                Fiche client
              </Link>
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
