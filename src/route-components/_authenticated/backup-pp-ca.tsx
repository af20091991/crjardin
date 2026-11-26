import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { CaBackupCard } from "@/components/admin/CaBackupCard";
import { useIsAdmin } from "@/hooks/use-admin";

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

export { BackupPpCaPage };
export default BackupPpCaPage;
