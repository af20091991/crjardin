import { isNativeApp, nativePlugin } from "@/lib/native-app";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Ouvre un PDF distant (URL signée). Sur l'appli native, le WebView ne sait pas
 * afficher un PDF avec défilement : on le télécharge en cache puis on ouvre le
 * partage natif (lecteur PDF du téléphone). Sur le web, on garde l'onglet.
 */
export async function openRemotePdf(url: string, fileName: string): Promise<void> {
  if (!isNativeApp()) {
    window.open(url, "_blank", "noopener");
    return;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Téléchargement du PDF impossible");
    const base64 = await blobToBase64(await response.blob());
    const safeName =
      fileName
        .replace(/[\\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "document";
    const filesystem = nativePlugin("Filesystem");
    const share = nativePlugin("Share");
    const written = await filesystem.writeFile({
      path: `${safeName}.pdf`,
      data: base64,
      directory: "CACHE",
      recursive: true,
    });
    await share.share({
      title: safeName,
      dialogTitle: "Ouvrir le compte rendu",
      files: [written.uri],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(message)) return;
    throw new Error("Ouverture du PDF indisponible : mettez l'application à jour.");
  }
}
