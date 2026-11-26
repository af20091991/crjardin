import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openUpdate } from "@/components/MobileUpdatePrompt";
import { checkMobileUpdate, type UpdateCheck } from "@/lib/mobile-update";
import { getCapacitor } from "@/lib/native-app";

/** Lien de secours : dernière version publiée sur GitHub Releases. */
export const APK_DOWNLOAD_URL =
  "https://github.com/af20091991/crjardin/releases/latest/download/PilotPro.apk";

/** Version de l'application mobile + recherche manuelle de mise à jour (appli uniquement). */
export function AppVersionCard() {
  const [check, setCheck] = useState<UpdateCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const native = !!getCapacitor()?.getPlatform && getCapacitor()?.getPlatform?.() !== "web";

  const run = async () => {
    setLoading(true);
    setCheck(await checkMobileUpdate());
    setLoading(false);
  };
  useEffect(() => {
    if (native) void run();
  }, [native]);

  if (!native) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Application mobile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {check && (
          <p className="text-muted-foreground">
            Version installée : build {check.installed || "inconnu"} · dernière version :{" "}
            {check.remote ? `${check.remote.versionName} (build ${check.remote.latestBuild})` : "—"}
          </p>
        )}
        {check?.error && <p className="text-xs text-destructive">{check.error}</p>}
        {check && !check.error && !check.outdated && (
          <p className="font-medium text-primary">L'application est à jour.</p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={run} disabled={loading}>
            {loading ? "Recherche…" : "Rechercher une mise à jour"}
          </Button>
          {check?.outdated && check.remote && (
            <Button size="sm" onClick={() => openUpdate(check.remote!)}>
              Mettre à jour
            </Button>
          )}
        </div>
        <a
          href={check?.remote?.apkUrl ?? APK_DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Télécharger le fichier APK
        </a>
      </CardContent>
    </Card>
  );
}
