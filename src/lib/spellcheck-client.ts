import { extractWords, resolveIssues, wordsToCheck, type SpellIssue } from "@/lib/spellcheck";

/**
 * Accès au dictionnaire français : il tourne dans un worker (public/spellcheck/worker.js)
 * chargé à la demande, pour ne pas figer l'interface. Aucun texte ne quitte le navigateur.
 */

const BASE = "/spellcheck/";
const PERSONAL_KEY = "pp-spellcheck-personal";
const REQUEST_TIMEOUT_MS = 45_000;

type Pending = {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let nextId = 1;
let failed = false;
let ready = false;
const pending = new Map<number, Pending>();
const sessionIgnored = new Set<string>();
const suggestionCache = new Map<string, string[]>();

function readPersonal(): Set<string> {
  try {
    const raw = window.localStorage.getItem(PERSONAL_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(
      Array.isArray(list) ? list.filter((w): w is string => typeof w === "string") : [],
    );
  } catch {
    return new Set();
  }
}

let personal: Set<string> | null = null;
function personalWords(): Set<string> {
  if (!personal) personal = readPersonal();
  return personal;
}

function getWorker(): Worker | null {
  if (failed || typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(`${BASE}worker.js`);
  } catch {
    failed = true;
    return null;
  }
  worker.onmessage = (event: MessageEvent<Record<string, unknown> & { id: number }>) => {
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    if (typeof event.data.error === "string") entry.reject(new Error(event.data.error));
    else {
      if (event.data.bad || event.data.suggestions || event.data.ready) ready = true;
      entry.resolve(event.data);
    }
  };
  worker.onerror = () => {
    failed = true;
    worker = null;
    for (const entry of pending.values()) entry.reject(new Error("Correcteur indisponible"));
    pending.clear();
  };
  for (const word of personalWords()) void request({ type: "add", word }).catch(() => {});
  return worker;
}

function request(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const w = getWorker();
  if (!w) return Promise.reject(new Error("Correcteur indisponible"));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error("Délai dépassé"));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, {
      resolve: (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    });
    w.postMessage({ id, base: BASE, ...payload });
  });
}

function isIgnored(word: string): boolean {
  const key = word.toLowerCase();
  return sessionIgnored.has(key) || personalWords().has(key);
}

/** Le dictionnaire est-il chargé ? (premier chargement : plusieurs secondes selon l'appareil) */
export function isDictionaryReady(): boolean {
  return ready;
}

/** Lance le chargement du dictionnaire en arrière-plan pour qu'il soit prêt à la première saisie. */
export function warmUpSpellchecker(): void {
  void request({ type: "warmup" }).catch(() => {});
}

/** Vrai tant que le correcteur n'a pas échoué (dictionnaire ou worker inaccessible). */
export function spellcheckAvailable(): boolean {
  return !failed && typeof Worker !== "undefined";
}

/** Fautes d'orthographe probables d'un texte. Renvoie [] si le correcteur est indisponible. */
export async function findSpellingIssues(text: string): Promise<SpellIssue[]> {
  const tokens = extractWords(text);
  if (tokens.length === 0) return [];
  try {
    const result = await request({ type: "check", words: wordsToCheck(tokens) });
    const bad = new Set((result.bad as string[] | undefined) ?? []);
    return resolveIssues(tokens, bad, isIgnored);
  } catch {
    return [];
  }
}

export async function suggestSpelling(word: string): Promise<string[]> {
  const cached = suggestionCache.get(word);
  if (cached) return cached;
  try {
    const result = await request({ type: "suggest", word });
    const list = ((result.suggestions as string[] | undefined) ?? []).slice(0, 5);
    suggestionCache.set(word, list);
    return list;
  } catch {
    return [];
  }
}

/** Ignore ce mot jusqu'au rechargement de la page. */
export function ignoreWordForSession(word: string): void {
  sessionIgnored.add(word.toLowerCase());
}

/** Ajoute le mot au dictionnaire personnel (mémorisé sur cet appareil). */
export function addToPersonalDictionary(word: string): void {
  const key = word.toLowerCase();
  personalWords().add(key);
  try {
    window.localStorage.setItem(PERSONAL_KEY, JSON.stringify([...personalWords()]));
  } catch {
    // Le mot reste connu pour la session courante.
  }
  void request({ type: "add", word: key }).catch(() => {});
}
