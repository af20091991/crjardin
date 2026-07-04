import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmailSettings, updateEmailSettings, EMAIL_TOKENS } from "@/lib/email-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Mail, Save } from "lucide-react";

const TOKEN_HELP = [
  { token: EMAIL_TOKENS.titre, desc: "Civilité du client (ex. Madame)" },
  { token: EMAIL_TOKENS.nom, desc: "Nom du client" },
  { token: EMAIL_TOKENS.date, desc: "Date de l'intervention" },
  { token: EMAIL_TOKENS.lien, desc: "Lien privé vers la fiche client" },
];

const SAMPLE = {
  titre: "Madame",
  nom: "Martin",
  date: "12 juillet 2026",
  lien: "https://crjardin.lovable.app/partage/exemple",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Construit l'e-mail tel que reçu par le client (rendu, sans balises). */
function buildPreviewHtml(subject: string, body: string): string {
  const filled = body
    .split(EMAIL_TOKENS.titre).join(SAMPLE.titre)
    .split(EMAIL_TOKENS.nom).join(SAMPLE.nom)
    .split(EMAIL_TOKENS.date).join(SAMPLE.date);
  const lines = filled.split("\n").map((line) => {
    const trimmed = line.trim();
    if (trimmed === "") return '<div style="height:8px"></div>';
    const withLink = esc(line).split(EMAIL_TOKENS.lien).join(
      `<a href="${SAMPLE.lien}" style="color:#4F8E33;font-weight:700;text-decoration:underline">${SAMPLE.lien}</a>`,
    );
    const isBullet = trimmed.startsWith("·");
    const style = isBullet
      ? "font-size:16px;line-height:1.5;color:#2f3a26;margin:0 0 4px 12px"
      : "font-size:16px;line-height:1.6;color:#2f3a26;margin:0 0 12px";
    return `<p style="${style}">${withLink}</p>`;
  });
  const garamond = "Garamond,'EB Garamond','Cormorant Garamond',Georgia,'Times New Roman',serif";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style="margin:0;background:#f4f4f4;font-family:${garamond}">
    <div style="padding:16px 8px;color:#666;font-size:12px;font-family:system-ui,sans-serif">
      <strong>Objet :</strong> ${esc(subject)}
    </div>
    <div style="background:#fff;max-width:600px;margin:0 auto;padding:24px;font-family:${garamond}">
      <div style="text-align:center;margin-bottom:4px">
        <p style="font-size:22px;font-weight:700;color:#4F8E33;margin:0">De la graine au jardin</p>
        <p style="font-size:14px;color:#EE8627;margin:2px 0 0;font-style:italic">au rythme de la nature</p>
      </div>
      <hr style="border:none;border-top:1px solid #e6e6e6;margin:16px 0 20px"/>
      ${lines.join("")}
    </div>
  </body></html>`;
}

export function EmailTemplateEditor() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["email-settings"],
    queryFn: getEmailSettings,
  });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (data) {
      setSubject(data.subject);
      setBody(data.body);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateEmailSettings({ subject, body }),
    onSuccess: () => {
      toast.success("Modèle d'e-mail enregistré");
      qc.invalidateQueries({ queryKey: ["email-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur d'enregistrement"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-primary" /> Modèle d'e-mail client
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Personnalisez l'e-mail envoyé aux clients pour les prévenir d'un nouveau
          compte-rendu. Les balises ci-dessous sont remplacées automatiquement à l'envoi.
        </p>

        {isPending ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {TOKEN_HELP.map((t) => (
                <span
                  key={t.token}
                  title={t.desc}
                  className="rounded-md bg-secondary px-2 py-1 font-mono text-xs text-secondary-foreground"
                >
                  {t.token}
                </span>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Objet</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-body">Corps du message</Label>
              <Textarea
                id="email-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={20}
                className="font-serif leading-relaxed"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Enregistrer
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Aperçu — l'e-mail tel que reçu par le client</Label>
              <div className="overflow-hidden rounded-lg border bg-muted/30">
                <iframe
                  title="Aperçu de l'e-mail"
                  className="h-[520px] w-full bg-white"
                  sandbox=""
                  srcDoc={buildPreviewHtml(subject, body)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Exemple avec un client fictif (Madame Martin). Les balises sont remplacées automatiquement à l'envoi.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
