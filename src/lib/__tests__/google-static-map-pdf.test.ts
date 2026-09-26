import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buildStaticGardenMapParams,
  calculateStaticGardenMapMarkerLayout,
  calculateStaticGardenMapViewport,
  SST_PDF_MAP_REFERER,
} from "@/lib/maps.functions";

describe("Google Static Maps — export PDF SST", () => {
  test("conserve le contrat de rendu de la carte PDF", () => {
    const params = buildStaticGardenMapParams(43.61, 3.88, [
      { lat: 43.611, lng: 3.881 },
      { lat: 43.612, lng: 3.882 },
    ]);

    expect(params.get("size")).toBe("640x540");
    expect(params.get("scale")).toBe("2");
    expect(params.get("format")).toBe("png");
    expect(params.get("maptype")).toBe("satellite");
    expect(params.get("language")).toBe("fr");
    const center = params.get("center")?.split(",").map(Number);
    expect(center?.[0]).toBeCloseTo(43.611, 6);
    expect(center?.[1]).toBeCloseTo(3.881, 6);
    expect(params.get("zoom")).toBe("17");

    const visible = params.getAll("visible");
    expect(visible).toEqual(["43.61,3.88", "43.611,3.881", "43.612,3.882"]);

    // Les repères sont volontairement absents des paramètres Google :
    // ils sont rendus une seule fois, numérotés, par le calque PDF.
    expect(params.getAll("markers")).toEqual([]);
    expect(params.getAll("style")).toEqual(["feature:poi|visibility:off"]);
  });

  test("adapte la séparation des badges à un nombre arbitraire de repères", () => {
    for (const count of [1, 2, 14, 40, 81, 120]) {
      const markers = Array.from({ length: count }, (_, index) => ({
        lat: 43.61 + (index % 12) * 0.00001,
        lng: 3.88 + Math.floor(index / 12) * 0.00001,
      }));
      const layouts = calculateStaticGardenMapMarkerLayout(43.61, 3.88, markers);

      expect(layouts).toHaveLength(count);
      expect(
        layouts.every((layout) =>
          [layout.anchorX, layout.anchorY, layout.labelX, layout.labelY].every(Number.isFinite),
        ),
      ).toBe(true);

      const uniqueLabels = new Set(
        layouts.map((layout) => `${layout.labelX.toFixed(2)},${layout.labelY.toFixed(2)}`),
      );
      expect(uniqueLabels.size).toBe(count);

      for (const layout of layouts) {
        expect(layout.labelX).toBeGreaterThanOrEqual(10);
        expect(layout.labelX).toBeLessThan(631);
        expect(layout.labelY).toBeGreaterThanOrEqual(10);
        expect(layout.labelY).toBeLessThan(531);
      }

      if (count > 1) {
        expect(
          layouts.some(
            (layout) =>
              Math.hypot(layout.labelX - layout.anchorX, layout.labelY - layout.anchorY) > 1,
          ),
        ).toBe(true);
      }
    }
  });

  test("zoome au maximum compatible avec tous les repères", () => {
    const viewport = calculateStaticGardenMapViewport(43.61, 3.88, [
      { lat: 43.6105, lng: 3.8805 },
      { lat: 43.6106, lng: 3.8806 },
      { lat: 43.6107, lng: 3.8807 },
    ]);

    expect(viewport.zoom).toBeGreaterThanOrEqual(18);
    expect(viewport.centerLat).toBeCloseTo(43.61035, 5);
    expect(viewport.centerLng).toBeCloseTo(3.88035, 5);
  });

  test("conserve les garde-fous indispensables au PDF", () => {
    const source = readFileSync(new URL("../maps.functions.ts", import.meta.url), "utf8");

    expect(source).toContain("https://maps.googleapis.com/maps/api/staticmap?");
    expect(source).toContain("VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY");
    expect(source).toContain("Referer: SST_PDF_MAP_REFERER");
    expect(source).toContain("response.arrayBuffer()");
    expect(source).toContain('data:${contentType.split(";")[0]};base64,${base64}');
    expect(SST_PDF_MAP_REFERER).toBe("https://crjardin.lovable.app/");
  });

  test("ne dessine jamais une pastille blanche pour les repères déplacés", () => {
    const source = readFileSync(new URL("../worksite-pdf-complete.ts", import.meta.url), "utf8");

    expect(source).not.toContain("doc.setFillColor(255, 255, 255)");
    expect(source).toContain("labelX, labelY, 4.1");
  });

  test("réaffirme le vert avant CHAQUE badge (pas seulement avant la boucle)", () => {
    // Régression : en PDF, setFillColor() et setTextColor() partagent le même
    // état de couleur de remplissage. Si le vert n'est réaffirmé qu'une seule
    // fois avant la boucle, le blanc du chiffre du badge N "fuit" sur le
    // disque du badge N+1 (qui se peint alors en blanc, chiffre invisible),
    // et l'effet se propage à tous les badges suivants. Un seul appel
    // `setFillColor(76, 138, 47)` situé AVANT `markerLayouts.forEach` ne
    // suffit donc pas : il en faut un second, à l'intérieur de la boucle,
    // juste avant `doc.circle(...)`.
    const source = readFileSync(new URL("../worksite-pdf-complete.ts", import.meta.url), "utf8");

    const forEachIndex = source.indexOf("markerLayouts.forEach");
    expect(forEachIndex).toBeGreaterThan(-1);
    const loopBody = source.slice(forEachIndex);

    const circleIndex = loopBody.indexOf("doc.circle(labelX, labelY, 4.1");
    expect(circleIndex).toBeGreaterThan(-1);

    // Le vert doit être réaffirmé À L'INTÉRIEUR du corps de la boucle,
    // juste avant l'appel à doc.circle — pas seulement une fois avant
    // markerLayouts.forEach(...).
    const beforeCircle = loopBody.slice(0, circleIndex);
    expect(beforeCircle).toContain("doc.setFillColor(76, 138, 47)");
  });
});
