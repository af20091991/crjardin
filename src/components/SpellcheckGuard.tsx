import { useEffect } from "react";

const TEXT_INPUT_TYPES = new Set(["", "text", "search"]);
const FIELD_SELECTOR = 'input, textarea, [contenteditable=""], [contenteditable="true"]';

function isTextField(element: Element): boolean {
  if (element instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(element.type);
  return element instanceof HTMLTextAreaElement || element instanceof HTMLElement;
}

function protect(element: Element) {
  if (!isTextField(element)) return;
  const field = element as HTMLElement;
  // Respecte un choix explicite (ex. champs techniques où la correction est volontairement coupée).
  if (!field.hasAttribute("spellcheck")) field.setAttribute("spellcheck", "true");
  if (!field.hasAttribute("lang")) field.setAttribute("lang", "fr");
}

function scan(root: ParentNode) {
  if (root instanceof Element && root.matches(FIELD_SELECTOR)) protect(root);
  root.querySelectorAll(FIELD_SELECTOR).forEach(protect);
}

/**
 * Filet de sécurité : active la correction orthographique française du navigateur
 * sur TOUT champ texte de l'application, y compris ceux ajoutés plus tard à l'écran
 * ou écrits sans passer par les composants Input / Textarea.
 */
export function SpellcheckGuard() {
  useEffect(() => {
    scan(document);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
