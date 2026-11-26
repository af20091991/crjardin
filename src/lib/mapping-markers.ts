/** Repères lisibles pour le module Mapping : regroupement des clients proches + icônes SVG. */

export interface PixelPoint {
  id: string;
  x: number;
  y: number;
}

export interface PointCluster {
  ids: string[];
  x: number;
  y: number;
}

/**
 * Regroupe les points dont les positions écran (en pixels) tombent dans la même case de `cell` px.
 * Un groupe d'un seul id = un client isolé ; sinon c'est une bulle avec le nombre de clients.
 */
export function clusterPixelPoints(points: PixelPoint[], cell = 46): PointCluster[] {
  const buckets = new Map<string, PixelPoint[]>();
  for (const p of points) {
    const key = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
    const list = buckets.get(key);
    if (list) list.push(p);
    else buckets.set(key, [p]);
  }
  return Array.from(buckets.values()).map((list) => ({
    ids: list.map((p) => p.id),
    x: list.reduce((sum, p) => sum + p.x, 0) / list.length,
    y: list.reduce((sum, p) => sum + p.y, 0) / list.length,
  }));
}

export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/[\s'-]+/)
    .filter((w) => w.length > 0);
  const letters = words
    .filter((w) => !/^(m|mme|mr|mlle|de|du|des|et|sci|sarl)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase());
  return letters.length > 0 ? letters.join("") : (name[0] ?? "?").toUpperCase();
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export interface MarkerIcon {
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

const CLIENT_COLOR = "#15803d";
const CLUSTER_COLOR = "#14532d";
const LOST_COLOR = "#6b7280";
const SELECTED_COLOR = "#ea580c";
const ORIGIN_COLOR = "#1d4ed8";

/** Épingle d'un client, avec ses initiales ; plus grande et orange quand elle est sélectionnée. */
export type PinTone = "active" | "lost";

export function clientPinIcon(
  name: string,
  selected: boolean,
  tone: PinTone = "active",
): MarkerIcon {
  const w = selected ? 46 : 36;
  const h = selected ? 58 : 46;
  const fill = selected ? SELECTED_COLOR : tone === "lost" ? LOST_COLOR : CLIENT_COLOR;
  const text = escapeXml(initials(name));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 36 46"><path d="M18 45C18 45 3 28 3 17A15 15 0 0 1 33 17C33 28 18 45 18 45Z" fill="${fill}" stroke="white" stroke-width="2.5"/><circle cx="18" cy="17" r="10.5" fill="white" fill-opacity="0.18"/><text x="18" y="22" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="white">${text}</text></svg>`;
  return { url: svgUrl(svg), width: w, height: h, anchorX: w / 2, anchorY: h };
}

/** Bulle de regroupement avec le nombre de clients. */
export function clusterIcon(count: number): MarkerIcon {
  const size = count < 10 ? 44 : count < 50 ? 52 : 60;
  const c = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${c - 1}" fill="${CLUSTER_COLOR}" fill-opacity="0.28"/><circle cx="${c}" cy="${c}" r="${c - 6}" fill="${CLUSTER_COLOR}" stroke="white" stroke-width="2.5"/><text x="${c}" y="${c + 5}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700" fill="white">${count}</text></svg>`;
  return { url: svgUrl(svg), width: size, height: size, anchorX: c, anchorY: c };
}

/** Point de départ (Vendargues) : maison bleue, toujours au premier plan. */
export function originIcon(): MarkerIcon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="${ORIGIN_COLOR}" stroke="white" stroke-width="2.5"/><path d="M11 21 20 12 29 21H26V28H22V23H18V28H14V21Z" fill="white"/></svg>`;
  return { url: svgUrl(svg), width: 40, height: 40, anchorX: 20, anchorY: 20 };
}
