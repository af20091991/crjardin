import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Brain, Calculator, Check, Command, Globe2, Lightbulb, Maximize2, Minimize2, Plus, Search, Send, Sparkles, Wrench, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DirecteurAction, DirecteurMode } from "@/lib/directeur-ia-contract";

type Message = { role: "user" | "assistant"; content: string; actions?: DirecteurAction[] };

const modes: { id: DirecteurMode; label: string; icon: typeof Brain; hint: string }[] = [
  { id: "direction", label: "Direction", icon: Lightbulb, hint: "Réfléchir, décider, conseiller" },
  { id: "data", label: "Données PP", icon: BarChart3, hint: "Analyser les données Pilot Pro" },
  { id: "calculate", label: "Calcul", icon: Calculator, hint: "Calculer et simuler" },
  { id: "search", label: "Recherche", icon: Search, hint: "Chercher des informations" },
  { id: "improve", label: "Améliorer PP", icon: Wrench, hint: "Proposer une évolution de Pilot Pro" },
];

const suggestions: Record<DirecteurMode, { label: string; icon: typeof Brain }[]> = {
  direction: [
    { label: "Aide-moi à prendre une décision", icon: Brain },
    { label: "Analyse ce qui mérite mon attention", icon: Lightbulb },
    { label: "Construis-moi un plan d'action", icon: Command },
  ],
  data: [
    { label: "Analyse mes données de cette page", icon: BarChart3 },
    { label: "Trouve les principales anomalies", icon: Brain },
    { label: "Compare avec l'année précédente", icon: BarChart3 },
  ],
  calculate: [
    { label: "Fais une simulation", icon: Calculator },
    { label: "Calcule l'impact financier", icon: Calculator },
    { label: "Compare plusieurs scénarios", icon: BarChart3 },
  ],
  search: [
    { label: "Cherche une information à jour", icon: Globe2 },
    { label: "Vérifie cette information", icon: Search },
    { label: "Trouve les sources utiles", icon: Globe2 },
  ],
  improve: [
    { label: "Améliore l'agencement de cette page", icon: Wrench },
    { label: "Propose une nouvelle fonction", icon: Command },
    { label: "Corrige ce qui ne fonctionne pas", icon: Wrench },
  ],
};

export function DirecteurIA() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<DirecteurMode>("direction");
  const [context, setContext] = useState({ pathname: "/", pageTitle: "Pilot Pro" });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentMode = useMemo(() => modes.find((item) => item.id === mode) ?? modes[0], [mode]);

  useEffect(() => {
    const update = () => setContext({ pathname: window.location.pathname, pageTitle: document.title });
    update();
    if (open) inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("popstate", update);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function sendMessage(text = draft) {
    const content = text.trim();
    if (!content || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setDraft("");
    setMessages(nextMessages);
    setLoading(true);

    try {
      const response = await supabase.functions.invoke("directeur-ia", {
        body: {
          messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
          context: { ...context, mode, modeHint: currentMode.hint },
        },
      });
      if (response.error) throw response.error;
      const result = response.data as { answer?: string; actions?: DirecteurAction[]; error?: string } | null;
      if (result?.error) throw new Error(result.error);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result?.answer || "Je n'ai pas obtenu de réponse exploitable.",
          actions: result?.actions,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Le Directeur IA n'est pas disponible : ${error instanceof Error ? error.message : "erreur inconnue"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" aria-label="Ouvrir le Directeur IA" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-[90] flex h-12 items-center gap-2 rounded-full border border-border/80 bg-background/95 px-4 text-sm font-medium text-foreground shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Directeur IA</span>
      </button>
    );
  }

  return (
    <section aria-label="Directeur IA" className={`fixed z-[100] flex flex-col overflow-hidden border border-border/80 bg-background/98 shadow-2xl backdrop-blur-xl transition-all duration-200 ${maximized ? "inset-4 rounded-2xl" : "bottom-5 right-5 h-[min(760px,calc(100vh-40px))] w-[min(760px,calc(100vw-40px))] rounded-2xl"}`}>
      <header className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Sparkles className="h-4 w-4 text-primary" /></div>
          <div className="min-w-0"><div className="text-sm font-semibold">Directeur IA</div><div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary" />{currentMode.label} · {context.pageTitle}</div></div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMessages([])} aria-label="Nouvelle conversation" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Plus className="h-4 w-4" /></button>
          <button type="button" onClick={() => setMaximized((value) => !value)} aria-label="Agrandir ou réduire" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">{maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="shrink-0 border-b border-border/60 px-3 py-2"><div className="flex gap-1 overflow-x-auto">{modes.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setMode(id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${mode === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div></div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col justify-center">
            <div className="mb-6"><p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Assistant de direction</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Que voulez-vous savoir ou améliorer ?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Je peux raisonner, analyser, calculer, rechercher et préparer des évolutions de Pilot Pro. Les détails techniques restent masqués.</p></div>
            <div className="grid gap-2 sm:grid-cols-3">{suggestions[mode].map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => void sendMessage(label)} className="flex min-h-24 flex-col items-start justify-between rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition hover:border-primary/30 hover:bg-primary/5"><Icon className="h-4 w-4 text-primary" /><span className="text-xs font-medium leading-5">{label}</span></button>)}</div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={message.role === "user" ? "max-w-[82%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground" : "max-w-[92%] rounded-2xl rounded-bl-md border border-border/70 bg-muted/30 px-4 py-3 text-sm leading-6 text-foreground"}>
                  <div className="whitespace-pre-wrap leading-6">{message.content}</div>
                  {message.actions && message.actions.length > 0 ? <div className="mt-3 space-y-2">{message.actions.map((action) => <div key={action.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/70 p-2.5"><div><div className="text-xs font-medium">{action.label}</div>{action.description ? <div className="mt-0.5 text-[11px] text-muted-foreground">{action.description}</div> : null}</div><button type="button" disabled className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground"><Check className="h-3 w-3" />Validation requise</button></div>)}</div> : null}
                </div>
              </div>
            ))}
            {loading ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />Le Directeur IA réfléchit…</div> : null}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-border/70 p-3"><div className="rounded-xl border border-border bg-background focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"><textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={`Demandez quelque chose · ${currentMode.hint}…`} rows={2} className="w-full resize-none bg-transparent px-3 pt-3 text-sm outline-none placeholder:text-muted-foreground" /><div className="flex items-center justify-between px-2 pb-2"><span className="px-1 text-[11px] text-muted-foreground">Entrée envoyer · Échap fermer</span><button type="button" onClick={() => void sendMessage()} disabled={!draft.trim() || loading} aria-label="Envoyer" className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button></div></div></footer>
    </section>
  );
}
