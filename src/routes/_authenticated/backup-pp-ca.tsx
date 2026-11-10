import { createFileRoute, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
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
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/backup-pp-ca"), "BackupPpCaPage"),
});
