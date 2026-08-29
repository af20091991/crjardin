import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GITHUB_API = "https://api.github.com";
const OWNER = "af20091991";
const REPO = "crjardin";
const DEFAULT_BASE = "feature/directeur-ia";
const PROTECTED_BRANCHES = new Set(["main", "master", DEFAULT_BASE]);
const BLOCKED_PREFIXES = [".github/workflows/", ".env", "supabase/config.toml"];
const BLOCKED_PATH_PARTS = [".env", ".git/"];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function safeBranch(value: unknown, fallback = "") {
  const branch = String(value || fallback).trim();
  if (!/^adpp\/[A-Za-z0-9._/-]+$/.test(branch)) throw new Error("Branche ADPP invalide");
  if (PROTECTED_BRANCHES.has(branch)) throw new Error("Branche protégée");
  return branch;
}

function safePath(value: unknown) {
  const path = String(value || "").trim().replace(/^\/+/, "");
  if (!path || path.includes("..")) throw new Error("Chemin de fichier invalide");
  if (BLOCKED_PREFIXES.some((p) => path.startsWith(p)) || BLOCKED_PATH_PARTS.some((p) => path.includes(p))) {
    throw new Error("Fichier sensible ou interdit");
  }
  return path;
}

async function github(path: string, init: RequestInit = {}) {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) throw new Error("GITHUB_TOKEN manquante");
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  try {
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "create_branch") {
      const base = String(body?.base || DEFAULT_BASE);
      if (!base || base === "main" || base === "master") throw new Error("Base protégée non autorisée pour une création ADPP");
      const branch = safeBranch(body?.branch, `adpp/${Date.now()}`);
      const baseRef = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${encodeURIComponent(base)}`) as { object: { sha: string } };
      const created = await github(`/repos/${OWNER}/${REPO}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }) });
      return json({ ok: true, branch, ref: created });
    }

    if (action === "write_file") {
      const branch = safeBranch(body?.branch);
      const path = safePath(body?.path);
      const content = String(body?.content || "");
      const message = String(body?.message || "ADPP: modification").slice(0, 180);
      const existing = await github(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(branch)}`).catch(() => null) as { sha?: string } | null;
      const payload: Record<string, unknown> = { message, content: btoa(unescape(encodeURIComponent(content))), branch };
      if (existing?.sha) payload.sha = existing.sha;
      const result = await github(`/repos/${OWNER}/${REPO}/contents/${path}`, { method: "PUT", body: JSON.stringify(payload) });
      return json({ ok: true, path, branch, result });
    }

    if (action === "validate") {
      const ref = safeBranch(body?.ref);
      await github(`/repos/${OWNER}/${REPO}/dispatches`, { method: "POST", body: JSON.stringify({ event_type: "adpp-validate", client_payload: { ref } }) });
      return json({ ok: true, ref, dispatched: true });
    }

    if (action === "create_pr") {
      const head = safeBranch(body?.head);
      const base = String(body?.base || "main");
      if (base !== "main") throw new Error("Une PR ADPP doit cibler main");
      const title = String(body?.title || "ADPP — modification").slice(0, 200);
      const description = String(body?.description || "Modification préparée et validée par ADPP.").slice(0, 10000);
      const pr = await github(`/repos/${OWNER}/${REPO}/pulls`, { method: "POST", body: JSON.stringify({ title, head, base, body: description, draft: true }) });
      return json({ ok: true, pullRequest: pr });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (error) {
    console.error("adpp-bridge", error);
    return json({ error: error instanceof Error ? error.message : "Erreur interne" }, 500);
  }
});
