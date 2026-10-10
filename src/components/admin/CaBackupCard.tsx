import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, Download, Loader2, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCaBackupDownloadUrl, getCaBackupStatus, runCaBackupNow } from "@/lib/pp-ca-backup.functions";
import { nextParisSundayAtThree } from "@/lib/pp-ca-backup";

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "medium", timeStyle: "short" }) : "—";
const fmtSize = (n: number | null | undefined) => (n ? `${(n / 1024).toFixed(1)} Ko` : "—");

export function CaBackupCard() {
  const qc = useQueryClient();
  const status = useServerFn(getCaBackupStatus);
  const run = useServerFn(runCaBackupNow);
  const signed = useServerFn(getCaBackupDownloadUrl);
  const q = useQuery({ queryKey: ["pp-ca-backup"], queryFn: () => status() });
  const m = useMutation({
    mutationFn: () => run(),
    onSuccess: (r) => {
      if (r.ok) toast.success("Backup PP CA créé");
      else toast.error(`Échec du backup : ${r.error}`);
      qc.invalidateQueries({ queryKey: ["pp-ca-backup"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const download = async (name: string) => {
    try {
      const { url } = await signed({ data: { name } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible");
    }
  };
  const last = q.data?.runs[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Archive className="h-4 w-4 text-primary" /> Backup PP CA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {q.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="grid gap-1 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Dernier backup : </span>
                {last ? (
                  <>
                    {fmtDate(last.created_at)} —{" "}
                    <span className={last.status === "success" ? "text-primary" : "text-destructive"}>
                      {last.status === "success" ? "Succès" : "Échec"}
                    </span>{" "}
                    ({last.trigger === "auto" ? "auto" : "manuel"}, {fmtSize(last.size_bytes)})
                  </>
                ) : (
                  "aucun"
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Prochaine exécution : </span>
                {fmtDate(nextParisSundayAtThree().toISOString())}
              </div>
              {last?.status === "error" && last.error_message && (
                <div className="text-destructive sm:col-span-2">{last.error_message}</div>
              )}
            </div>
            <div className="space-y-2">
              {(q.data?.files ?? []).length === 0 && (
                <p className="text-muted-foreground">Aucune copie conservée.</p>
              )}
              {q.data?.files.map((f) => (
                <div key={f.name} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span>
                    {f.name} <span className="text-muted-foreground">· {fmtDate(f.createdAt)} · {fmtSize(f.size)}</span>
                  </span>
                  <Button variant="outline" size="sm" onClick={() => download(f.name)}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Télécharger
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
        <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
          Lancer un backup maintenant
        </Button>
        <p className="text-xs text-muted-foreground">
          Chaque dimanche à 03:00 (Europe/Paris), l'onglet « CA &lt;année&gt; » reproduit la page Chiffre
          d'affaires « à date » de l'exercice courant. Les données lues sont celles du compte administrateur
          propriétaire des lignes de CA (celui qui en détient le plus), sans mélange avec d'autres comptes.
          Les 2 copies les plus récentes sont conservées.
        </p>
      </CardContent>
    </Card>
  );
}
