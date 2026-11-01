import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SharedRecommendation } from "@/lib/share.functions";
import { updateRecommendationContent } from "@/lib/client-premium";

/** Encart éditable (accueil du dashboard Premium). */
export function EditableBlock({
  title,
  value,
  onSave,
}: {
  title: string;
  value: string | null;
  onSave: (next: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft.trim() || null);
      toast.success("Enregistré");
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        {!editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(true);
            }}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Modifier
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            disabled={saving}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Annuler
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
              {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{value || "Non renseigné"}</p>
      )}
    </Card>
  );
}

/** Ligne de préconisation éditable (titre, description, retour client affiché). */
export function EditableRecommendation({
  reco,
  onSaved,
}: {
  reco: SharedRecommendation;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(reco.title);
  const [description, setDescription] = useState(reco.description ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      toast.error("Le titre est obligatoire.");
      return;
    }
    setSaving(true);
    try {
      await updateRecommendationContent(reco.id, {
        title: title.trim(),
        description: description.trim() || null,
      });
      toast.success("Préconisation enregistrée");
      setEditing(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const badge =
    reco.client_interest === "interested" ? (
      <Badge className="shrink-0 bg-green-600 hover:bg-green-600">
        <Check className="mr-1 h-3 w-3" />
        Intéressé
      </Badge>
    ) : reco.client_interest === "not_interested" ? (
      <Badge className="shrink-0 bg-red-600 hover:bg-red-600">
        <X className="mr-1 h-3 w-3" />
        Pas intéressé
      </Badge>
    ) : (
      <Badge variant="outline" className="shrink-0">
        Sans réponse
      </Badge>
    );

  if (editing) {
    return (
      <li className="space-y-2 py-3 text-sm">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          disabled={saving}
          placeholder="Description"
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            Annuler
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-3 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{reco.title}</p>
        {reco.description && <p className="mt-1 text-muted-foreground">{reco.description}</p>}
        <Button
          type="button"
          variant="link"
          className="mt-1 h-auto p-0 text-xs"
          onClick={() => {
            setTitle(reco.title);
            setDescription(reco.description ?? "");
            setEditing(true);
          }}
        >
          <Pencil className="mr-1 h-3 w-3" />
          Modifier
        </Button>
      </div>
      {badge}
    </li>
  );
}
