import { useState } from "react";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export interface RecommendationTarget {
  id: string;
  title: string | null;
  intervention_type: string | null;
  intervention_date: string;
}

/** Formulaire d'ajout d'une préconisation, rattachée à une intervention ou hors intervention. */
export function NewRecommendationForm({
  interventions,
  onCreate,
}: {
  interventions: RecommendationTarget[];
  onCreate: (input: {
    interventionId: string | null;
    title: string;
    description: string | null;
  }) => Promise<void>;
}) {
  const NONE = "__none__";
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>(interventions[0]?.id ?? NONE);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setOpen(false);
  };

  const save = async () => {
    if (!title.trim()) {
      toast.error("Le titre est obligatoire.");
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        interventionId: target === NONE ? null : target,
        title: title.trim(),
        description: description.trim() || null,
      });
      toast.success("Préconisation ajoutée");
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Ajouter une préconisation
      </Button>
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Nouvelle préconisation
      </p>
      <Select value={target} onValueChange={setTarget} disabled={saving}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Hors intervention</SelectItem>
          {interventions.map((iv) => (
            <SelectItem key={iv.id} value={iv.id}>
              {iv.title ?? iv.intervention_type ?? "Intervention"} ·{" "}
              {new Date(iv.intervention_date).toLocaleDateString("fr-FR")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de la préconisation"
        disabled={saving}
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Description (facultative)"
        disabled={saving}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={reset}>
          Annuler
        </Button>
        <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
          {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Ajouter
        </Button>
      </div>
    </Card>
  );
}
