// Recherche globale (⌘K / Ctrl+K) : accès direct à un client, un contrat,
// un sous-traitant ou un écran depuis n'importe quelle page.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  loadSearchIndex,
  searchIndex,
  SEARCH_KIND_LABELS,
  SEARCH_PAGES,
  type SearchKind,
  type SearchResult,
} from "@/lib/pilot-search";

const KIND_ORDER: SearchKind[] = ["page", "client", "ceev", "sst"];

export function GlobalSearch({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: index = SEARCH_PAGES } = useQuery({
    queryKey: ["pilot-search-index"],
    queryFn: loadSearchIndex,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const results = useMemo(() => searchIndex(index, query), [index, query]);
  const grouped = useMemo(() => {
    const map = new Map<SearchKind, SearchResult[]>();
    for (const r of results) map.set(r.kind, [...(map.get(r.kind) ?? []), r]);
    return KIND_ORDER.filter((k) => map.has(k)).map((k) => ({ kind: k, items: map.get(k)! }));
  }, [results]);

  const go = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate({ to: r.to, params: r.params } as never);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Recherche globale (Ctrl+K)"
        className={`flex items-center gap-2 rounded-lg border border-border bg-background/60 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground ${
          collapsed ? "justify-center p-2" : "w-full px-3 py-2"
        }`}
      >
        <Search className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">Rechercher…</span>
            <kbd className="rounded border border-border px-1 text-[10px]">⌘K</kbd>
          </>
        )}
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Client, contrat, sous-traitant, écran…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>
          {grouped.map((g) => (
            <CommandGroup key={g.kind} heading={SEARCH_KIND_LABELS[g.kind]}>
              {g.items.map((r) => (
                <CommandItem key={r.id} value={`${r.label} ${r.detail ?? ""}`} onSelect={() => go(r)}>
                  <span className="truncate">{r.label}</span>
                  {r.detail && (
                    <span className="ml-auto truncate text-xs text-muted-foreground">{r.detail}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}