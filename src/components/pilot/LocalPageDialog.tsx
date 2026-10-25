import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createLocalPageDraft, previewLocalPage } from "@/lib/visibilite-locale-page.functions";
import type { ScoredOpportunity } from "@/lib/visibilite-locale";

export function LocalPageDialog({ o }: { o: ScoredOpportunity }) {
  const [open, setOpen] = useState(false);
  const [particularity, setParticularity] = useState("");
  const input = {
    prestation: o.prestation,
    commune: o.commune,
    topQueries: o.topQueries.map((q) => q.query),
    particularity: particularity.trim() || undefined,
  };

  const preview = useMutation({ mutationFn: () => previewLocalPage({ data: input }) });
  const create = useMutation({
    mutationFn: () => createLocalPageDraft({ data: input }),
    onSuccess: (r) =>
      toast.success("Brouillon créé dans WordPress", {
        description: r.seoApplied
          ? r.editUrl
          : "Titre SEO, description et mot-clé Rank Math à saisir à la main.",
      }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Création impossible"),
  });

  const result = preview.data;
  const blocked =
    !result ||
    result.exists ||
    !result.state.configured ||
    !result.state.registryReady ||
    result.state.usedThisMonth >= result.state.limit;

  const copyHtml = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.draft.html);
      toast.success("HTML copié");
    } catch {
      toast.error("Copie impossible");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) preview.mutate();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
          <FilePlus2 className="mr-1 h-3.5 w-3.5" />
          Préparer la page
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {o.prestation} · {o.commune}
          </DialogTitle>
          <DialogDescription>
            Brouillon uniquement : rien n'est publié. Vous relisez et publiez vous-même dans
            WordPress.
          </DialogDescription>
        </DialogHeader>

        {preview.isPending && <p className="text-sm text-muted-foreground">Préparation…</p>}
        {preview.isError && <p className="text-sm text-destructive">Aperçu indisponible.</p>}

        {result && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-medium">{result.draft.title}</p>
              <p className="text-xs text-muted-foreground">
                /{result.draft.slug} · {result.draft.wordCount} mots · mot-clé :{" "}
                {result.draft.focusKeyword}
              </p>
            </div>

            <ul className="grid gap-1 text-xs sm:grid-cols-2">
              {result.draft.checks.map((c) => (
                <li key={c.label} className={c.ok ? "text-muted-foreground" : "text-destructive"}>
                  {c.ok ? "✓" : "•"} {c.label}
                  {c.detail ? ` (${c.detail})` : ""}
                </li>
              ))}
            </ul>

            <div>
              <label className="text-xs font-medium" htmlFor="particularity">
                Particularité locale (facultatif, remplace le passage « À compléter »)
              </label>
              <Textarea
                id="particularity"
                value={particularity}
                onChange={(e) => setParticularity(e.target.value)}
                onBlur={() => preview.mutate()}
                rows={3}
                maxLength={600}
              />
            </div>

            <div
              className="max-h-64 overflow-y-auto rounded-md border p-3 text-sm [&_h2]:mt-3 [&_h2]:font-serif [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-medium [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{
                __html: result.draft.html.replace(/<script[\s\S]*?<\/script>/g, ""),
              }}
            />

            <div className="space-y-1 text-xs text-muted-foreground">
              {result.exists && <p>Une page existe déjà pour cette combinaison.</p>}
              {!result.state.configured && (
                <p>Accès WordPress non configuré : utilisez « Copier le HTML ».</p>
              )}
              {!result.state.registryReady && <p>Registre des pages non initialisé.</p>}
              <p>
                Pages créées ce mois-ci : {result.state.usedThisMonth}/{result.state.limit}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void copyHtml()}>
                Copier le HTML
              </Button>
              <Button disabled={blocked || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? "Envoi…" : "Envoyer en brouillon"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
