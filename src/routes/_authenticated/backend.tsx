import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useIsAdmin } from "@/hooks/use-admin";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  FileText,
  Mail,
  Settings,
  History,
  LayoutTemplate,
  Database,
  ChevronRight,
} from "lucide-react";
import { APP_NAME, APP_VERSION } from "@/lib/app-meta";

export const Route = createFileRoute("/_authenticated/backend")({
  head: () => ({ meta: [{ title: "Backend — De la graine au jardin" }] }),
  component: BackendPage,
});

type Section = {
  to: string;
  label: string;
  description: string;
  icon: typeof Users;
};

const SECTIONS: Section[] = [
  {
    to: "/admin",
    label: "Utilisateurs & accès",
    description: "Comptes, rôles, approbations et journaux de connexion.",
    icon: Users,
  },
  {
    to: "/modeles",
    label: "Modèles de comptes-rendus",
    description: "Créez et personnalisez les modèles réutilisables.",
    icon: LayoutTemplate,
  },
  {
    to: "/emails",
    label: "E-mails & modèles d'e-mails",
    description: "Suivi des envois et personnalisation des messages.",
    icon: Mail,
  },
  {
    to: "/settings",
    label: "Réglage & signature",
    description: "Profil de l'entreprise, cachet et signature.",
    icon: Settings,
  },
  {
    to: "/versions",
    label: "Versions",
    description: "Historique des évolutions de l'application.",
    icon: History,
  },
  {
    to: "/interventions",
    label: "Fiches CR Pro",
    description: "Historique complet des comptes-rendus d'intervention.",
    icon: FileText,
  },
];

function BackendPage() {
  const { isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  if (isLoading || !isAdmin) return null;

  return (
    <AppShell title="Backend">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Paramètres de l'application</h2>
            <p className="text-sm text-muted-foreground">
              {APP_NAME} v{APP_VERSION} — tous les réglages personnalisables au même endroit.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <Link key={section.to} to={section.to}>
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/30">
                <CardContent className="flex items-start gap-3 py-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <section.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center justify-between font-medium">
                      {section.label}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}