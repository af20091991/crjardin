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
          </>
        )}
      </CardContent>
    </Card>
  );
}
