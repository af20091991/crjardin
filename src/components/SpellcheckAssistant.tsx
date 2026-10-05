import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addToPersonalDictionary,
  findSpellingIssues,
  ignoreWordForSession,
  isDictionaryReady,
  spellcheckAvailable,
  warmUpSpellchecker,
  suggestSpelling,
} from "@/lib/spellcheck-client";
import {
  buildMirrorSegments,
  isProseField,
  matchCase,
  replaceIssueAt,
  type SpellIssue,
} from "@/lib/spellcheck";

type TextField = HTMLInputElement | HTMLTextAreaElement;

const DEBOUNCE_MS = 500;
const MAX_LENGTH = 20_000;
const MAX_SUGGESTIONS = 5;

interface MenuState {
  x: number;
  y: number;
  issue: SpellIssue;
}

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
    searchLike:
      target.getAttribute("role") === "combobox" ||
      target.hasAttribute("cmdk-input") ||
      target.hasAttribute("aria-autocomplete"),
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
 * Détecteur d'orthographe de PP : surveille les champs de texte rédigé (délégation
 * d'événements, donc aussi les champs ajoutés plus tard), souligne en rouge ondulé les mots
 * douteux directement dans le champ et propose des corrections au clic droit. Le texte ne
 * quitte jamais le navigateur.
 */
export function SpellcheckAssistant() {
  const [field, setField] = useState<TextField | null>(null);
  const [issues, setIssues] = useState<SpellIssue[]>([]);
  const [, setTick] = useState(0);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const timer = useRef<number | null>(null);
  const run = useRef(0);
  const fieldRef = useRef<TextField | null>(null);
  const issuesRef = useRef<SpellIssue[]>([]);
  const frame = useRef<number | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      setTick((value) => value + 1);
    });
  }, []);

  const analyse = useCallback(async (target: TextField) => {
    const ticket = ++run.current;
    const text = target.value.slice(0, MAX_LENGTH);
    const found = text.trim() ? await findSpellingIssues(text) : [];
    if (ticket !== run.current || fieldRef.current !== target) return;
    issuesRef.current = found;
    setIssues(found);
  }, []);

  useEffect(() => {
    if (!spellcheckAvailable()) return;

    // Le premier chargement du dictionnaire prend plusieurs secondes : on le lance dès que
    // l'application est au repos, pour qu'il soit prêt avant la première saisie.
    const idle = window.setTimeout(warmUpSpellchecker, 1500);

    const onFocusIn = (event: FocusEvent) => {
      const target = asTextField(event.target);
      if (!target) return;
      if (fieldRef.current !== target) {
        issuesRef.current = [];
        setIssues([]);
      }
      fieldRef.current = target;
      warmUpSpellchecker();
      setField(target);
      setMenu(null);
      void analyse(target);
    };
    const onInput = (event: Event) => {
      const target = asTextField(event.target);
      if (!target || target !== fieldRef.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void analyse(target), DEBOUNCE_MS);
      refresh();
    };
    const onContextMenu = (event: MouseEvent) => {
      const target = fieldRef.current;
      if (!target || event.target !== target || !mirrorRef.current) return;
      const spans = mirrorRef.current.querySelectorAll<HTMLElement>("[data-issue-start]");
      for (const span of spans) {
        for (const box of span.getClientRects()) {
          if (
            event.clientX >= box.left - 1 &&
            event.clientX <= box.right + 1 &&
            event.clientY >= box.top - 1 &&
            event.clientY <= box.bottom + 1
          ) {
            const start = Number(span.dataset.issueStart);
            const issue = issuesRef.current.find((item) => item.start === start);
            if (!issue) continue;
            event.preventDefault();
            setSuggestions(null);
            setMenu({ x: event.clientX, y: event.clientY, issue });
            return;
          }
        }
      }
    };
    const onPointerDown = (event: Event) => {
      const node = event.target as Element | null;
      if (node?.closest?.("[data-spell-menu]")) return;
      setMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    const onViewportChange = () => refresh();

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("input", onInput, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      window.clearTimeout(idle);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
      if (timer.current) window.clearTimeout(timer.current);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [analyse, refresh]);

  // Redimensionnement du champ (poignée des zones de texte, mise en page qui change).
  useEffect(() => {
    if (!field || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(refresh);
    observer.observe(field);
    return () => observer.disconnect();
  }, [field, refresh]);

  // Propositions de correction pour le mot visé par le menu.
  useEffect(() => {
    if (!menu) return;
    let alive = true;
    void suggestSpelling(menu.issue.word).then((list) => {
      if (alive) setSuggestions(list.slice(0, MAX_SUGGESTIONS));
    });
    return () => {
      alive = false;
    };
  }, [menu]);

  // Place le miroir sous les yeux de l'utilisateur après chaque rendu (position, défilement).
  useLayoutEffect(() => {
    const mirror = mirrorRef.current;
    if (!mirror || !field) return;
    const inner = mirror.firstElementChild as HTMLElement | null;
    if (inner) inner.style.transform = `translate(${-field.scrollLeft}px, ${-field.scrollTop}px)`;
  });

  if (!field || typeof document === "undefined") return null;
  if (!field.isConnected) return null;

  const rect = field.getBoundingClientRect();
  const visible =
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth;
  const segments = buildMirrorSegments(field.value, issues);
  const hasIssues = segments.some((segment) => segment.issue);

  const replace = (issue: SpellIssue, replacement: string) => {
    const next = replaceIssueAt(field.value, issue, matchCase(issue.word, replacement));
    setMenu(null);
    if (next !== field.value) {
      setFieldValue(field, next, issue.start + replacement.length);
    }
    field.focus();
    void analyse(field);
  };

  const dismiss = (issue: SpellIssue, persist: boolean) => {
    if (persist) addToPersonalDictionary(issue.word);
    else ignoreWordForSession(issue.word);
    setMenu(null);
    field.focus();
    void analyse(field);
  };

  const style = window.getComputedStyle(field);
  const isTextarea = field instanceof HTMLTextAreaElement;
  const textStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    wordSpacing: style.wordSpacing,
    textTransform: style.textTransform as React.CSSProperties["textTransform"],
    textIndent: style.textIndent,
    textAlign: style.textAlign as React.CSSProperties["textAlign"],
    tabSize: style.tabSize as unknown as number,
    direction: style.direction as React.CSSProperties["direction"],
    paddingTop: style.paddingTop,
    paddingRight: style.paddingRight,
    paddingBottom: style.paddingBottom,
    paddingLeft: style.paddingLeft,
    boxSizing: "border-box",
    color: "transparent",
  };

  const menuLeft = menu ? Math.min(menu.x, window.innerWidth - 232) : 0;
  const menuTop = menu ? Math.min(menu.y, window.innerHeight - 260) : 0;

  return createPortal(
    <>
      {visible && hasIssues ? (
        <div
          ref={mirrorRef}
          aria-hidden="true"
          data-no-spellcheck
          className="pointer-events-none fixed z-[60] overflow-hidden"
          style={{
            left: rect.left + field.clientLeft,
            top: rect.top + field.clientTop,
            width: field.clientWidth,
            height: field.clientHeight,
          }}
        >
          <div
            style={{
              ...textStyle,
              width: isTextarea ? field.clientWidth : "max-content",
              minWidth: "100%",
              minHeight: isTextarea ? undefined : field.clientHeight,
              display: isTextarea ? "block" : "flex",
              alignItems: isTextarea ? undefined : "center",
            }}
          >
            <div
              style={{
                whiteSpace: isTextarea ? "pre-wrap" : "pre",
                overflowWrap: isTextarea ? "break-word" : undefined,
                wordBreak: isTextarea ? "normal" : undefined,
              }}
            >
              {segments.map((segment, index) =>
                segment.issue ? (
                  <span
                    key={`${segment.issue.start}-${index}`}
                    data-issue-start={segment.issue.start}
                    style={{
                      textDecorationLine: "underline",
                      textDecorationStyle: "wavy",
                      textDecorationColor: "var(--destructive)",
                      textDecorationThickness: "1.5px",
                      textUnderlineOffset: "2px",
                      textDecorationSkipInk: "none",
                    }}
                  >
                    {segment.text}
                  </span>
                ) : (
                  <span key={`t-${index}`}>{segment.text}</span>
                ),
              )}
            </div>
          </div>
        </div>
      ) : null}
      {menu ? (
        <div
          role="menu"
          aria-label="Corrections orthographiques"
          data-spell-menu
          data-no-spellcheck
          className="pointer-events-auto fixed z-[80] w-56 rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
          style={{ left: menuLeft, top: menuTop }}
          onMouseDown={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {suggestions === null ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {isDictionaryReady() ? "Recherche…" : "Chargement du dictionnaire…"}
            </p>
          ) : suggestions.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Aucune suggestion</p>
          ) : (
            suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                role="menuitem"
                onClick={() => replace(menu.issue, suggestion)}
                className="block w-full rounded-sm px-2 py-1.5 text-left font-semibold hover:bg-accent hover:text-accent-foreground"
              >
                {matchCase(menu.issue.word, suggestion)}
              </button>
            ))
          )}
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => dismiss(menu.issue, false)}
            className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
          >
            Ignorer
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => dismiss(menu.issue, true)}
            className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
          >
            Ajouter au dictionnaire
          </button>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
