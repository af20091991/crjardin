// Pré-devis — export copiable (HTML autonome, imprimable en PDF).
// Reprend le modèle de l'écran Pré-devis : postes, lignes, totaux, récapitulatif, texte client.
// Chaque valeur est un bouton « copier » (sans symbole €, virgule décimale) ; la ligne et le poste se copient en un clic.

import type { ChantierFinance, PosteFinance } from "@/lib/predevis-finance";

export type ExportRow = {
  ref: string | null;
  designation: string;
  kind: "fourniture" | "mo";
  continued: boolean;
  quantity: number | null;
  /** Achat HT (PAU) de la ligne, null si non connu. */
  pau: number | null;
  /** Libellé affiché à la place du PAU quand il est absent (« prix manquant », « sans achat »…). */
  pauLabel: string;
  pu: number | null;
  ht: number | null;
  ttc: number | null;
  /** Rattachement catalogue, tel qu'affiché à l'écran. */
  rattachement: string;
};

export type ExportPoste = {
  index: number;
  title: string;
  themes: string[];
  rows: ExportRow[];
  fin: PosteFinance;
  sst: number | null;
  clientText: string;
};

export type ExportQuote = {
  title: string;
  devisNumber: string | null;
  createdAt: string;
  archived: boolean;
  totalHtDeclared: number | null;
  chantier: ChantierFinance;
  postes: ExportPoste[];
};

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Montant à coller dans un logiciel : virgule décimale, sans symbole. */
export const exportAmount = (n: number | null | undefined): string =>
  n == null ? "" : n.toFixed(2).replace(".", ",");

/** Montant affiché : « 1 234,50 € » ou « — ». */
const shown = (n: number | null | undefined): string => (n == null ? "—" : `${exportAmount(n)} €`);

const pct = (n: number | null | undefined): string =>
  n == null ? "—" : `${n.toFixed(2).replace(".", ",")} %`;

/** Valeur cliquable : copie la valeur brute. */
function cp(raw: string, label: string, display = raw): string {
  if (raw === "") return `<span class="muted">—</span>`;
  return `<button type="button" class="cp" data-copy="${esc(raw)}" title="Copier ${esc(label)}">${esc(display)}</button>`;
}

/** Ligne au format tabulé : collable directement dans un tableur ou un logiciel de devis. */
export function rowTsv(r: ExportRow): string {
  return [
    r.ref ?? "",
    r.designation,
    exportAmount(r.quantity),
    exportAmount(r.pau),
    exportAmount(r.pu),
    exportAmount(r.ht),
    exportAmount(r.ttc),
  ].join("\t");
}

function posteTsv(p: ExportPoste): string {
  const head = ["Réf.", "Désignation", "Qté", "PAU HT", "PU HT", "HT", "TTC"].join("\t");
  return [head, ...p.rows.map(rowTsv)].join("\n");
}

function rowHtml(r: ExportRow, label: string): string {
  const pauCell =
    r.pau != null
      ? cp(exportAmount(r.pau), `PAU HT, ${label}`, shown(r.pau))
      : `<span class="${r.pauLabel === "prix manquant" ? "flag" : "muted"}">${esc(r.pauLabel)}</span>`;
  return `<tr>
  <td class="ref">${r.ref ? esc(r.ref) : `<span class="muted">—</span>`}</td>
  <td class="des">${esc(r.designation)}${r.continued ? ` <em class="tag">suite</em>` : ""}${r.kind === "mo" ? ` <em class="tag">MO</em>` : ""}</td>
  <td class="num">${r.quantity != null ? cp(exportAmount(r.quantity), `Qté, ${label}`, String(r.quantity).replace(".", ",")) : `<span class="muted">—</span>`}</td>
  <td class="num">${pauCell}</td>
  <td class="num">${r.pu != null ? cp(exportAmount(r.pu), `PU HT, ${label}`, shown(r.pu)) : `<span class="muted">—</span>`}</td>
  <td class="num">${r.ht != null ? cp(exportAmount(r.ht), `HT, ${label}`, shown(r.ht)) : `<span class="muted">—</span>`}</td>
  <td class="num">${r.ttc != null ? cp(exportAmount(r.ttc), `TTC, ${label}`, shown(r.ttc)) : `<span class="muted">—</span>`}</td>
  <td class="rat">${esc(r.rattachement)}</td>
  <td class="act"><button type="button" class="cp row" data-copy="${esc(rowTsv(r))}" title="Copier la ligne">Copier la ligne</button></td>
</tr>`;
}

function tile(label: string, raw: string, display: string): string {
  return `<div class="tile"><p>${esc(label)}</p><p class="val">${raw === "" ? `<span class="muted">—</span>` : cp(raw, label, display)}</p></div>`;
}

function posteHtml(p: ExportPoste): string {
  const label = `poste ${p.index}`;
  const f = p.fin;
  const taux = f.tauxMargeAvecSst ?? f.tauxMarge;
  const recap: [string, string, string][] = [
    ["PV HT", exportAmount(f.pvHt), shown(f.pvHt)],
    ["PV TTC", exportAmount(f.pvTtc), shown(f.pvTtc)],
    ["PAU HT (fournitures)", exportAmount(f.achatFournituresHt), shown(f.achatFournituresHt)],
    ["Prix de revient HT (fournitures + MO)", exportAmount(f.prixAchatHt), shown(f.prixAchatHt)],
    ["Marge nette HT", exportAmount(f.margeHt), shown(f.margeHt)],
    ["Coût SST", exportAmount(p.sst), shown(p.sst)],
    ["Marge après SST", exportAmount(f.margeAvecSstHt), shown(f.margeAvecSstHt)],
    ["Taux de marge après SST", exportAmount(taux), pct(taux)],
  ];
  return `<section class="poste">
  <header>
    <h2>Poste ${p.index} — ${cp(p.title, `titre du ${label}`, p.title || "sans nom")}</h2>
    <p class="themes">${p.themes.map((t) => `<span class="theme">${esc(t)}</span>`).join("") || `<span class="muted">Sans thème</span>`}</p>
    <button type="button" class="cp poste-all" data-copy="${esc(posteTsv(p))}">Copier le poste (tableau)</button>
  </header>
  <div class="scroll"><table>
    <thead><tr><th>Réf.</th><th>Désignation</th><th>Qté</th><th>PAU HT</th><th>PU HT</th><th>HT</th><th>TTC</th><th>Rattachement</th><th></th></tr></thead>
    <tbody>${p.rows.map((r) => rowHtml(r, label)).join("\n")}</tbody>
    <tfoot><tr><td colspan="2">Total poste ${p.index}</td><td></td><td class="num">${f.achatFournituresHt != null ? cp(exportAmount(f.achatFournituresHt), "PAU total", shown(f.achatFournituresHt)) : "—"}</td><td></td><td class="num">${f.pvHt != null ? cp(exportAmount(f.pvHt), "total HT", shown(f.pvHt)) : "—"}</td><td class="num">${f.pvTtc != null ? cp(exportAmount(f.pvTtc), "total TTC", shown(f.pvTtc)) : "—"}</td><td colspan="2"></td></tr></tfoot>
  </table></div>
  <div class="grid">
    <dl class="recap">${recap.map(([l, raw, d]) => `<div><dt>${esc(l)}</dt><dd>${raw === "" ? `<span class="muted">—</span>` : cp(raw, l, d)}</dd></div>`).join("")}</dl>
    <div class="client">
      <div class="client-head"><strong>Texte client</strong>
        <button type="button" class="cp" data-copy="${esc(p.clientText)}">Copier le texte</button></div>
      <pre>${esc(p.clientText || "—")}</pre>
    </div>
  </div>
</section>`;
}

const CSS = `
:root{--fg:#1c1f23;--muted:#6b7280;--line:#e5e7eb;--accent:#1d4ed8;--bg:#fff;--warn:#b45309;--soft:#f5f7fa}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--fg:#e8eaed;--muted:#9aa0a6;--line:#2e333a;--accent:#8ab4f8;--bg:#15171a;--warn:#fbbf24;--soft:#1e2126}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px max(16px,env(safe-area-inset-left,0px)) 48px}
main{max-width:1180px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}
h2{font-size:17px;margin:0 0 6px}
.meta{color:var(--muted);margin:0 0 20px}
.muted{color:var(--muted)}
.flag{color:var(--warn);font-weight:600}
.tag{font-size:11px;border:1px solid var(--line);border-radius:4px;padding:0 4px;font-style:normal;color:var(--muted)}
.theme{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:1px 8px;margin:0 6px 6px 0;font-size:12px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin:0 0 28px}
.tile{border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.tile p{margin:0}
.tile .val{font-weight:600;margin-top:4px}
.poste{border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 24px;page-break-inside:avoid}
.poste header{margin-bottom:10px}
.scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
td.num{text-align:right;white-space:nowrap}
td.ref{white-space:nowrap;color:var(--muted)}
td.rat{font-size:12px;color:var(--muted)}
tfoot td{font-weight:600;background:var(--soft)}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;margin-top:14px}
dl.recap{margin:0}
dl.recap>div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:5px 0}
dl.recap dt{color:var(--muted)}
dl.recap dd{margin:0;font-weight:600;text-align:right}
.client{border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.client-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
.client pre{white-space:pre-wrap;font:inherit;margin:0;color:var(--fg)}
button.cp{font:inherit;color:var(--accent);background:transparent;border:1px solid var(--line);border-radius:6px;padding:1px 6px;cursor:pointer;text-align:inherit}
button.cp:hover{border-color:var(--accent)}
button.cp.row,button.cp.poste-all{font-size:12px;white-space:nowrap}
button.cp.poste-all{margin-top:4px}
td.act{text-align:right}
.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--fg);color:var(--bg);padding:8px 14px;border-radius:8px;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.on{opacity:1}
@media (max-width:760px){.grid{grid-template-columns:1fr}}
@media print{
  body{padding:0}
  button.cp{border:none;padding:0;color:inherit}
  button.cp.row,button.cp.poste-all,.noprint{display:none}
  .poste{break-inside:avoid}
}`;

const SCRIPT = `
(function(){
  var t=document.getElementById('toast');
  function say(m){t.textContent=m;t.classList.add('on');clearTimeout(say.h);say.h=setTimeout(function(){t.classList.remove('on')},1400);}
  function copy(text){
    if(navigator.clipboard&&navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error('no clipboard'));
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('button.cp');
    if(!b)return;
    var text=b.getAttribute('data-copy');
    copy(text).then(function(){say('Copié : '+(text.length>60?text.slice(0,57)+'…':text).replace(/\\t/g,' · '));})
      .catch(function(){
        var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();
        try{document.execCommand('copy');say('Copié');}catch(_){say('Copie impossible : sélectionne le texte');}
        ta.remove();
      });
  });
})();`;

/** Document HTML autonome du devis, prêt à ouvrir, copier et imprimer en PDF. */
export function buildQuoteExportHtml(q: ExportQuote): string {
  const c = q.chantier;
  const tiles: [string, number | null, string][] = [
    ["PV HT", c.pvHt, "PV HT"],
    ["PV TTC", null, ""],
    ["Coût d'achat HT", c.prixAchatHt, "coût d'achat"],
    ["Marge nette HT", c.margeHt, "marge nette"],
    ["Taux de marge", c.tauxMarge, ""],
    ["Coût SST", c.sstCostHt, "coût SST"],
    ["Marge après SST", c.margeAvecSstHt, "marge après SST"],
    ["Taux après SST", c.tauxMargeAvecSst, ""],
  ];
  const tileHtml = tiles
    .map(([label, v, copyLabel]) => {
      if (label === "Taux de marge" || label === "Taux après SST") {
        return tile(label, exportAmount(v), pct(v));
      }
      if (label === "PV TTC") {
        const ttc = q.postes.reduce<number | null>(
          (s, p) => (p.fin.pvTtc == null ? s : (s ?? 0) + p.fin.pvTtc),
          null,
        );
        return tile(label, exportAmount(ttc), shown(ttc));
      }
      return tile(label, exportAmount(v), shown(v));
    })
    .join("");
  const created = new Date(q.createdAt).toLocaleDateString("fr-FR");
  const quoteTsv = q.postes
    .map((p) => `Poste ${p.index} — ${p.title}\n${posteTsv(p)}`)
    .join("\n\n");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pré-devis — ${esc(q.title)}</title>
<style>${CSS}</style></head>
<body><main>
  <h1>${esc(q.title)}</h1>
  <p class="meta">${q.devisNumber ? `Devis n° ${esc(q.devisNumber)} · ` : ""}Enregistré le ${esc(created)}${q.archived ? " · Archivé" : ""} · Total HT déclaré ${q.totalHtDeclared != null ? cp(exportAmount(q.totalHtDeclared), "total HT déclaré", shown(q.totalHtDeclared)) : "—"}</p>
  <div class="noprint"><button type="button" class="cp" data-copy="${esc(quoteTsv)}">Copier tout le devis (tableaux)</button>
  <span class="muted"> · Pour un PDF : Imprimer puis « Enregistrer au format PDF ».</span></div>
  <h2 style="margin:24px 0 10px">Chantier — tous postes</h2>
  <div class="tiles">${tileHtml}</div>
  ${q.postes.map(posteHtml).join("\n")}
  <p class="meta">Montants HT sauf mention contraire. Cliquer sur une valeur la copie sans symbole, avec virgule décimale.</p>
</main>
<div id="toast" class="toast" role="status"></div>
<script>${SCRIPT}</script>
</body></html>`;
}
