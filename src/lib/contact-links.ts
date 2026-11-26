/** Liens « appel / SMS / itinéraire » : ouvrent directement les applis du téléphone. */

export type MapPlatform = "android" | "ios" | "web";

export function cleanPhone(phone: string): string {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

export function telHref(phone: string): string | undefined {
  const p = cleanPhone(phone);
  return p.replace("+", "").length >= 4 ? `tel:${p}` : undefined;
}

export function smsHref(phone: string): string | undefined {
  const p = cleanPhone(phone);
  return p.replace("+", "").length >= 4 ? `sms:${p}` : undefined;
}

export function mapPlatform(userAgent: string): MapPlatform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  return "web";
}

/** Itinéraire vers une adresse : appli cartes du téléphone (Android/iOS), sinon Google Maps. */
export function routeHref(address: string, platform: MapPlatform = "web"): string | undefined {
  const a = address.trim();
  if (!a) return undefined;
  const q = encodeURIComponent(a);
  if (platform === "android") return `geo:0,0?q=${q}`;
  if (platform === "ios") return `https://maps.apple.com/?daddr=${q}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}
