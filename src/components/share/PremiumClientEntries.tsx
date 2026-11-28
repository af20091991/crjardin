import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addSharedClientNote,
  setSharedGardenIntro,
  type SharedClientNote,
} from "@/lib/share.functions";

const SIGNATURE_MIN = 2;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Mention visible côté client et côté admin : la saisie vient du client, signée. */
function ClientSignature({ by, at }: { by: string; at: string }) {
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Modifié par le client · signé {by} le {formatDate(at)}
    </p>
  );
}

/** Portrait du jardin : une seule version, la dernière saisie remplace la précédente. */
export function PortraitEditor({
  token,
  customText,
  signedBy,
  signedAt,
}: {
  token: string;
  customText: string | null;
  signedBy: string | null;
  signedAt: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(customText ?? "");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = !saving && text.trim().length > 0 && name.trim().length >= SIGNATURE_MIN;

  async function save() {
    setSaving(true);
    try {
      await setSharedGardenIntro({ data: { token, text, signedBy: name } });
      toast.success("Portrait enregistré");
      setOpen(false);
      setName("");
      await qc.invalidateQueries({ queryKey: ["shared-premium", token] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      {customText && signedBy && signedAt && <ClientSignature by={signedBy} at={signedAt} />}
      {!open ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            setText(customText ?? "");
            setOpen(true);
          }}
        >
          Modifier la phrase
        </Button>
      ) : (
        <div className="mt-3 space-y-3">
          <Textarea
            value={text}
            maxLength={500}
            rows={3}
            onChange={(event) => setText(event.target.value)}
            aria-label="Phrase du portrait du jardin"
          />
          <Input
            value={name}
            maxLength={100}
            placeholder="Votre nom (signature)"
            onChange={(event) => setName(event.target.value)}
            aria-label="Nom du signataire"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!canSave} onClick={save}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** « Mes notes » : entrées signées, ajout seulement. */
export function ClientNotes({ token, notes }: { token: string; notes: SharedClientNote[] }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = !saving && body.trim().length > 0 && name.trim().length >= SIGNATURE_MIN;

  async function save() {
    setSaving(true);
    try {
      await addSharedClientNote({ data: { token, body, signedBy: name } });
      toast.success("Note enregistrée");
      setBody("");
      await qc.invalidateQueries({ queryKey: ["shared-premium", token] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-t pt-10">
      <h3 className="font-['Cormorant_Garamond',Georgia,serif] text-3xl">Mes notes</h3>
      <div className="mt-6 space-y-3">
        <Textarea
          value={body}
          maxLength={2000}
          rows={4}
          placeholder="Vos observations sur le jardin"
          onChange={(event) => setBody(event.target.value)}
          aria-label="Nouvelle note"
        />
        <Input
          value={name}
          maxLength={100}
          placeholder="Votre nom (signature)"
          onChange={(event) => setName(event.target.value)}
          aria-label="Nom du signataire"
        />
        <Button size="sm" disabled={!canSave} onClick={save}>
          {saving ? "Enregistrement…" : "Ajouter la note"}
        </Button>
      </div>
      <div className="mt-8 space-y-6">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune note pour l’instant.</p>
        ) : (
          notes.map((note) => (
            <article key={note.id} className="border-l-2 border-primary/30 pl-4">
              <p className="whitespace-pre-wrap text-sm leading-7">{note.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Saisi par le client · signé {note.signed_by} le {formatDate(note.created_at)}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
