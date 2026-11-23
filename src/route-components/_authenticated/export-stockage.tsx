import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import JSZip from "jszip";
import { Download, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/use-admin";
import {
  listBucketFilesForExport,
  listStorageBuckets,
  type StorageExportFile,
} from "@/lib/storage-export.functions";

const PART_MAX_BYTES = 300 * 1024 * 1024;

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function splitParts(files: StorageExportFile[]) {
  const parts: StorageExportFile[][] = [];
  let cur: StorageExportFile[] = [];
  let size = 0;
  for (const f of files) {
    if (cur.length && size + f.size > PART_MAX_BYTES) {
      parts.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(f);
    size += f.size;
  }
  if (cur.length) parts.push(cur);
  return parts;
}

function BucketRow({ name }: { name: string }) {
  const listFiles = useServerFn(listBucketFilesForExport);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);

  async function run() {
    setBusy(true);
    setFailed([]);
    try {
      setStatus("Liste des fichiers…");
      const files = await listFiles({ data: { bucket: name } });
      if (!files.length) {
        setStatus("Bucket vide.");
        return;
      }
      const parts = splitParts(files);
      const errors: string[] = [];
      let done = 0;
      for (let p = 0; p < parts.length; p++) {
        const zip = new JSZip();
        for (const f of parts[p]!) {
          try {
            const res = await fetch(f.url);
            if (!res.ok) throw new Error(String(res.status));
            zip.file(f.path, await res.blob());
          } catch {
            errors.push(f.path);
          }
          done++;
          setStatus(`Fichiers ${done}/${files.length} (partie ${p + 1}/${parts.length})`);
        }
        setStatus(`Création du ZIP partie ${p + 1}/${parts.length}…`);
        const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
        const suffix = parts.length > 1 ? `-partie-${p + 1}` : "";
        saveBlob(blob, `${name}${suffix}.zip`);
      }
      setFailed(errors);
      setStatus(
        errors.length
          ? `Terminé : ${files.length - errors.length} fichiers, ${errors.length} en échec.`
          : `Terminé : ${files.length} fichiers téléchargés.`,
      );
    } catch (e) {
      setStatus(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-foreground">{name}</div>
        <Button onClick={run} disabled={busy} size="sm">
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Télécharger (ZIP)
        </Button>
      </div>
      {status && <p className="mt-2 text-sm text-muted-foreground">{status}</p>}
      {failed.length > 0 && (
        <p className="mt-1 text-xs text-destructive">
          Non récupérés : {failed.slice(0, 10).join(", ")}
        </p>
      )}
    </div>
  );
}

function ExportStockagePage() {
  const { isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();
  const listBuckets = useServerFn(listStorageBuckets);
  const buckets = useQuery({
    queryKey: ["storage-export-buckets"],
    queryFn: () => listBuckets(),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  if (isLoading || !isAdmin) return null;

  return (
    <AppShell title="Export du stockage">
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Chaque bouton télécharge tout le contenu d'un bucket, dossiers compris. Les gros buckets
          sont découpés en plusieurs ZIP de 300 Mo maximum. Gardez la page ouverte pendant le
          téléchargement.
        </p>
        {buckets.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {buckets.error && <p className="text-sm text-destructive">{String(buckets.error)}</p>}
        {(buckets.data ?? []).map((b) => (
          <BucketRow key={b.name} name={b.name} />
        ))}
      </div>
    </AppShell>
  );
}

export { ExportStockagePage };
export default ExportStockagePage;
