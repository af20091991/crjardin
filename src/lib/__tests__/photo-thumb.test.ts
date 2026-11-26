import { describe, expect, it } from "bun:test";
import { photoThumbUrl } from "@/lib/photo-thumb";

describe("photoThumbUrl", () => {
  it("passe par la transformation Storage pour un fichier public", () => {
    expect(photoThumbUrl("https://x.supabase.co/storage/v1/object/public/b/a.jpg")).toBe(
      "https://x.supabase.co/storage/v1/render/image/public/b/a.jpg?width=640&quality=70",
    );
  });
  it("garde l'URL d'origine pour les autres hôtes", () => {
    expect(photoThumbUrl("https://exemple.fr/a.jpg")).toBe("https://exemple.fr/a.jpg");
  });
});
