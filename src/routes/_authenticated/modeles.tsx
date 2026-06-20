import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listTemplates, addTemplate, deleteTemplate } from "@/lib/templates";
import { INTERVENTION_TYPES, COMMON_TASKS } from "@/lib/interventions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutTemplate, Plus, Trash2, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/modeles")({
  head: () => ({ meta: [{ title: "Modèles de compte-rendu — De la graine au jardin" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const qc = useQueryClient();
  const { data: templates } = useQuery({ queryKey: ["report-templates"], queryFn: listTemplates });
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(INTERVENTION_TYPES[0]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [summary, setSummary] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["report-templates"] });
  const create = useMutation({
    mutationFn: () => addTemplate({ name, intervention_type: type, tasks, summary: summary || null }),
    onSuccess: () => { setName(""); setTasks([]); setSummary(""); invalidate(); toast.success("Modèle créé"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const remove = useMutation({ mutationFn: deleteTemplate, onSuccess: invalidate });
  const toggle = (t: string) => setTasks((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);

  return (
    <AppShell title="Modèles">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
              <LayoutTemplate className="h-5 w-5 text-primary" /> Nouveau modèle
            </h3>
            <div className="space-y-1.5">
              <Label>Nom du modèle</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Entretien mensuel standard" />
            </div>
            <div className="space-y-1.5">
              <Label>Type d'intervention</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INTERVENTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Travaux pré-cochés</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_TASKS.map((t) => {
                  const active = tasks.includes(t);
                  return (
                    <button key={t} type="button" onClick={() => toggle(t)}
                      className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      {active && <Check className="h-3 w-3" />}{t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Résumé type (facultatif)</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Texte récurrent à pré-remplir…" />
            </div>
            <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
              <Plus className="mr-1.5 h-4 w-4" /> Créer le modèle
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {(templates ?? []).map((tpl) => (
            <Card key={tpl.id}>
              <CardContent className="flex items-start justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{tpl.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tpl.intervention_type && <Badge variant="secondary">{tpl.intervention_type}</Badge>}
                    {tpl.tasks.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                  </div>
                </div>
                <Button size="icon" variant="ghost" aria-label="Supprimer" onClick={() => remove.mutate(tpl.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {(templates?.length ?? 0) === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucun modèle. Créez-en un pour gagner du temps.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
