import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, Calculator, Globe2, Maximize2, Minimize2, Minus, Plus, Send, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Message = { role: "user" | "assistant"; content: string };

type AssistantResponse = {
  answer?: string;
  error?: string;
};

const suggestions = [
  { label: "Analyser mes données", icon: Brain },
  { label: "Faire un calcul", icon: Calculator },
  { label: "Chercher une information", icon: Globe2 },
];

export function DirecteurIA() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const context = useMemo(() => ({
    pathname: window.location.pathname,
    pageTitle: document.title,
  }), [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function sendMessage(text = draft) {
    const content = text.trim();
    if (!content || loading) return;

    setDraft("");
    setMessages((current) => [...current, { role: "user", content }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke<AssistantResponse>("directeur-ia", {
        body: {
          messages: [...messages, { role: "user", content }],
          context,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages((current) => [
        ...current,
        { role: "assistant", content: data?.answer ?? "Je n'ai pas obtenu de réponse exploitable." },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Le Directeur IA n'est pas encore disponible : ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Ouvrir le Directeur IA"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[90] flex h-12 items-center gap-2 rounded-full border border-border/80 bg-background/95 px-4 text-sm font-medium text-foreground shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Directeur IA</span>
      </button>
    );
  }

  return (
    <section
      aria-label="Directeur IA"
      className={`fixed z-[100] flex flex-col overflow-hidden border border-border/80 bg-background/98 shadow-2xl backdrop-blur-xl transition-all duration-200 ${
        maximized
          ? "inset-4 rounded-2xl"
          : "bottom-5 right-5 h-[min(720px,calc(100vh-40px))] w-[min(620px,calc(100vw-40px))] rounded-2xl"
      }`}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Directeur IA</div>
            <div className="text-xs text-muted-foreground">Analyse · calcul · stratégie · recherche</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMessages([])} aria-label="Nouvelle conversation" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setMaximized((value) => !value)} aria-label={maximized ? "Réduire" : "Agrandir"} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-xl flex-col justify-center">
            <div className="mb-7">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Assistant de direction</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Que voulez-vous savoir ou décider ?</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                Je peux raisonner avec vous, effectuer des calculs, analyser les données de Pilot Pro et préparer des actions. Je distingue toujours les données disponibles des hypothèses.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {suggestions.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => sendMessage(label)}
                  className="flex min-h-24 flex-col items-start justify-between rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition hover:border-primary/30 hover:bg-primary/5"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium leading-5">{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={message.role === "user" ? "max-w-[82%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground" : "max-w-[90%] rounded-2xl rounded-bl-md border border-border/70 bg-muted/30 px-4 py-3 text-sm leading-6 text-foreground"}>
                  {message.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
                Analyse en cours…
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-border/70 p-3">
        <div className="rounded-xl border border-border bg-background focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="Posez une question, demandez un calcul ou une analyse…"
            rows={2}
            className="w-full resize-none bg-transparent px-3 pt-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="px-1 text-[11px] text-muted-foreground">Entrée pour envoyer · Maj+Entrée pour aller à la ligne</span>
            <button type="button" onClick={() => void sendMessage()} disabled={!draft.trim() || loading} aria-label="Envoyer" className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}
