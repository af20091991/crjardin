import { describe, expect, it } from "bun:test";
import { cleanPhone, mapPlatform, routeHref, smsHref, telHref } from "@/lib/contact-links";

describe("contact-links", () => {
  it("nettoie les numéros", () => {
    expect(cleanPhone("06 12 34 56 78")).toBe("0612345678");
    expect(cleanPhone(" +33 6 12.34.56.78 ")).toBe("+33612345678");
  });
  it("construit tel: et sms:", () => {
    expect(telHref("06 12 34 56 78")).toBe("tel:0612345678");
    expect(smsHref("+33 6 12 34 56 78")).toBe("sms:+33612345678");
    expect(telHref("abc")).toBe(undefined);
  });
  it("choisit l'appli cartes selon la plateforme", () => {
    expect(mapPlatform("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
    expect(mapPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17)")).toBe("ios");
    expect(mapPlatform("Mozilla/5.0 (X11; Linux)")).toBe("web");
    expect(routeHref("3 rue A, Colmar", "android")).toBe("geo:0,0?q=3%20rue%20A%2C%20Colmar");
    expect(routeHref("3 rue A", "ios")).toContain("maps.apple.com");
    expect(routeHref("3 rue A")).toContain("google.com/maps/dir");
    expect(routeHref("  ")).toBe(undefined);
  });
});
