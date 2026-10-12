import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { CaBackupCard } from "@/components/admin/CaBackupCard";
import { useIsAdmin } from "@/hooks/use-admin";

export const Route = createFileRoute("/_authenticated/backup-pp-ca")({
  head: () => ({
    meta: [
      { title: "Backup PP CA — De la graine au jardin" },
      {
        name: "description",
        content: "Sauvegarde Excel hebdomadaire de la page Chiffre d'affaires.",
      },
      { property: "og:title", content: "Backup PP CA — De la graine au jardin" },
      {
        property: "og:description",
        content: "Sauvegarde Excel hebdomadaire de la page Chiffre d'affaires.",
      },
    ],
  }),
  component: BackupPpCaPage,
});

function BackupPpCaPage() {
  const { isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  if (isLoading || !isAdmin) return null;

  return (
    <AppShell title="Backup PP CA">
      <div className="mx-auto max-w-4xl space-y-5">
        <CaBackupCard />
      </div>
    </AppShell>
  );
}
