import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import {
  addToPersonalDictionary,
  findSpellingIssues,
  ignoreWordForSession,
  spellcheckAvailable,
  suggestSpelling,
} from "@/lib/spellcheck-client";
import { groupIssues, isProseField, replaceIssues, type SpellIssue } from "@/lib/spellcheck";

type TextField = HTMLInputElement | HTMLTextAreaElement;

const DEBOUNCE_MS = 600;
const MAX_LENGTH = 20_000;
const MAX_WORDS_SHOWN = 8;

function asTextField(target: EventTarget | null): TextField | null {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return null;
  const ok = isProseField({
    tag: target.tagName,
    type: target instanceof HTMLInputElement ? target.type : null,
    id: target.id,
    name: target.name,
    autocomplete: target.getAttribute("autocomplete"),
    spellcheck: target.getAttribute("spellcheck"),
    readOnly: target.readOnly,
    disabled: target.disabled,
    optOut: Boolean(target.closest("[data-no-spellcheck]")),
  });
  return ok ? target : null;
}

/** Écrit une valeur dans un champ contrôlé par React et le prévient du changement. */
function setFieldValue(field: TextField, value: string, caret: number) {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  try {
    field.setSelectionRange(caret, caret);
  } catch {
    // Certains types de champ n'exposent pas de sélection.
  }
}

/**
 * Détecteur d'orthographe de PP : surveille tous les champs de texte rédigé (délégation
 * d'événements, donc aussi les champs ajoutés plus tard), repère les fautes avec un
 * dictionnaire français local et propose des corrections. Le texte ne quitte jamais
 * le navigateur.
 */
export function SpellcheckAssistant() {
  const [field, setField] = useState<TextField | null>(null);
  const [issues, setIssues] = useState<SpellIssue[]>([]);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const timer = useRef<number | null>(null);
  const run = useRef(0);
  const fieldRef = useRef<TextField | null>(null);

  const analyse = useCallback(async (target: TextField) => {
    const ticket = ++run.current;
    const text = target.value.slice(0, MAX_LENGTH);
    const found = text.trim() ? await findSpellingIssues(text) : [];
    if (ticket !== run.current || fieldRef.current !== target) return;
    setIssues(found);
    if (found.length > 0) target.setAttribute("data-spell-issues", "true");
    else target.removeAttribute("data-spell-issues");
  }, []);

  useEffect(() => {
    if (!spellcheckAvailable()) return;

    const onFocusIn = (event: FocusEvent) => {
      const target = asTextField(event.target);
      if (!target) return;
      fieldRef.current = target;
      setField(target);
      setOpen(false);
      setRect(target.getBoundingClientRect());
      void analyse(target);
    };
    const onInput = (event: Event) => {
      const target = asTextField(event.target);
      if (!target || target !== fieldRef.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void analyse(target), DEBOUNCE_MS);
      setRect(target.getBoundingClientRect());
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.target !== fieldRef.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      run.current++;
      fieldRef.current = null;
      setField(null);
      setOpen(false);
    };
    const reposition = () => {
      if (fieldRef.current) setRect(fieldRef.current.getBoundingClientRect());
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("input", onInput, true);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [analyse]);

  const groups = groupIssues(issues);
  const shown = groups.slice(0, MAX_WORDS_SHOWN);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void Promise.all(
      shown.map(async ({ word }) => [word, await suggestSpelling(word)] as const),
    ).then((entries) => {
      if (alive) setSuggestions(Object.fromEntries(entries));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, issues]);

  if (!field || !rect || issues.length === 0 || typeof document === "undefined") return null;

  const replace = (word: string, replacement: string) => {
    const next = replaceIssues(field.value, issues, word, replacement);
    if (next === field.value) {
      void analyse(field);
      return;
    }
    const first = issues.find((issue) => issue.word === word);
    setFieldValue(field, next, (first?.start ?? 0) + replacement.length);
    void analyse(field);
  };

  const dismiss = (word: string, persist: boolean) => {
    if (persist) addToPersonalDictionary(word);
    else ignoreWordForSession(word);
    void analyse(field);
  };

  const keepFocus = (event: React.MouseEvent) => event.preventDefault();
  // Champ dans la moitié basse de l'écran : le panneau s'ouvre vers le haut pour rester visible.
  const above = rect.bottom > window.innerHeight * 0.6;
  const right = Math.max(window.innerWidth - rect.right, 8);
  const position = above
    ? { bottom: Math.max(window.innerHeight - rect.top + 4, 8), right }
    : { top: Math.min(rect.bottom + 4, window.innerHeight - 40), right };

  return createPortal(
    <div
      className={`fixed z-[70] flex items-end gap-1 ${above ? "flex-col-reverse" : "flex-col"}`}
      style={position}
      onMouseDown={keepFocus}
      data-no-spellcheck
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-background px-2.5 py-1 text-xs font-medium text-destructive shadow-sm hover:bg-destructive/10"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {issues.length} faute{issues.length > 1 ? "s" : ""} possible{issues.length > 1 ? "s" : ""}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Corrections orthographiques"
          className="w-80 max-w-[92vw] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg"
        >
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Orthographe</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {shown.map(({ word, count }) => (
              <li key={word} className="rounded-md border border-border p-2">
                <p className="text-sm">
                  <span className="font-semibold text-destructive">{word}</span>
                  {count > 1 ? (
                    <span className="ml-1 text-xs text-muted-foreground">× {count}</span>
                  ) : null}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(suggestions[word] ?? []).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => replace(word, suggestion)}
                      className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      {suggestion}
                    </button>
                  ))}
                  {suggestions[word] && suggestions[word].length === 0 ? (
                    <span className="text-xs text-muted-foreground">Aucune suggestion</span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                  <button type="button" className="underline" onClick={() => dismiss(word, false)}>
                    Ignorer
                  </button>
                  <button type="button" className="underline" onClick={() => dismiss(word, true)}>
                    Ajouter au dictionnaire
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {groups.length > shown.length ? (
            <p className="mt-1 text-xs text-muted-foreground">
              + {groups.length - shown.length} autre{groups.length - shown.length > 1 ? "s" : ""}{" "}
              mot
              {groups.length - shown.length > 1 ? "s" : ""} à vérifier
            </p>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
