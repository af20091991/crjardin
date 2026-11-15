import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Nom d'un poste, modifiable à la main : le titre détecté dans le PDF peut être une phrase d'information. */
export function PosteTitleEdit({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (title: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{value || "sans nom (à nommer)"}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Renommer le poste"
          onClick={() => {
            setText(value ?? "");
            setEditing(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </span>
    );
  }

  async function commit() {
    const title = text.trim();
    if (!title) {
      toast.error("Le nom du poste ne peut pas être vide.");
      return;
    }
    setSaving(true);
    try {
      await onSave(title);
      setEditing(false);
    } catch {
      toast.error("Nom du poste non enregistré, réessayez");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="inline-flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void commit();
      }}
    >
      <Input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Nom du poste"
        className="h-9 w-[min(460px,70vw)] font-normal"
      />
      <Button type="submit" size="sm" disabled={saving}>
        Enregistrer
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Annuler
      </Button>
    </form>
  );
}
