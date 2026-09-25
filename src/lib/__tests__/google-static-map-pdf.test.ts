import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildStaticGardenMapParams, SST_PDF_MAP_REFERER } from "@/lib/maps.functions";

describe("Google Static Maps — export PDF SST", () => {
  test("conserve le contrat de rendu de la carte PDF", () => {
    const params = buildStaticGardenMapParams(
      43.61,
      3.88,
      [
        { lat: 43.611, lng: 3.881 },
        { lat: 43.612, lng: 3.882 },
      ],
    );

    expect(params.get("size")).toBe("640x540");
    expect(params.get("scale")).toBe("2");
    expect(params.get("format")).toBe("png");
    expect(params.get("maptype")).toBe("hybrid");
    expect(params.get("language")).toBe("fr");

    const visible = params.getAll("visible");
    expect(visible).toEqual([
      "43.61,3.88",
      "43.611,3.881",
      "43.612,3.882",
    ]);

    const markers = params.getAll("markers");
    expect(markers).toHaveLength(3);
    expect(markers[0]).toContain("label:1");
    expect(markers[1]).toContain("label:2");
    expect(markers[2]).toContain("43.61,3.88");
  });

  test("conserve les garde-fous indispensables au PDF", () => {
    const source = readFileSync(
      new URL("../maps.functions.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      "https://maps.googleapis.com/maps/api/staticmap?",
    );
    expect(source).toContain(
      "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY",
    );
    expect(source).toContain("Referer: SST_PDF_MAP_REFERER");
    expect(source).toContain("response.arrayBuffer()");
    expect(source).toContain(
      'data:${contentType.split(";")[0]};base64,${base64}',
    );
    expect(SST_PDF_MAP_REFERER).toBe("https://crjardin.lovable.app/");
  });
});
