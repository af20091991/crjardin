import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { readCatalogueFile } from "@/lib/predevis-catalogue-file";
import type { ImportPlan } from "@/lib/predevis-catalogue-import";
import type { MatrixSource } from "@/lib/predevis-catalogue-matrix";
import { analyseCatalogue, applyCatalogueImport } from "@/lib/predevis-data";

type Pending = { source: MatrixSource; fileName: string; plan: ImportPlan };

export function CatalogueImport() {
  const [excel, setExcel] = useState<File | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function analyse(file: File) {
    setBusy(true);
    try {
      const rows = await readCatalogueFile(file);
      const plan = await analyseCatalogue("excel", rows);
      setPending({ source: "excel", fileName: file.name, plan });
      setConfirmed([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lecture du fichier impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!pending) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Session expirée, reconnecte-toi.");
      const res = await applyCatalogueImport({
        plan: pending.plan,
        fileName: pending.fileName,
        confirmedSuppliers: confirmed,
        userId,
      });
      toast.success(`Import enregistré : ${res.productCount} produits, ${res.offerCount} offres.`);
      setPending(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setBusy(false);
    }
  }

  const r = pending?.plan.report;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Catalogue fournisseurs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="predevis-excel">Excel fournisseurs (onglet « Produits »)</Label>
            <input
              id="predevis-excel"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setExcel(e.target.files?.[0] ?? null)}
            />
            <Button size="sm" disabled={!excel || busy} onClick={() => excel && analyse(excel)}>
              Analyser
            </Button>
          </div>
        </CardContent>
      </Card>

      {r && pending && (
        <Card>
          <CardHeader>
            <CardTitle>Rapport — {pending.fileName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              {r.rows_read} lignes lues · {r.products} produits à enregistrer · {r.excluded.length}{" "}
              exclues (services, main-d'œuvre, sans référence)
            </p>

            {r.duplicates.length > 0 && (
              <section>
                <h3 className="font-medium">Références en double (non importées, à trancher)</h3>
                <p className="text-muted-foreground">{r.duplicates.join(", ")}</p>
              </section>
            )}

            <section>
              <h3 className="font-medium">Prix d'achat manquant ({r.missing_price.length})</h3>
              <p className="text-muted-foreground">Enregistrés sans prix. Aucune estimation.</p>
              <ul className="list-disc pl-5">
                {r.missing_price.slice(0, 50).map((m) => (
                  <li key={m.norm_code}>
                    {m.norm_code} — {m.designation} {m.pau_raw ? `(${m.pau_raw})` : ""}
                  </li>
                ))}
              </ul>
            </section>

            {r.unknown_suppliers.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-medium">Fournisseurs inconnus</h3>
                <p className="text-muted-foreground">
                  Cochés = créés. Non cochés = ignorés pour l'instant.
                </p>
                {r.unknown_suppliers.map((name) => (
                  <div key={name} className="flex items-center gap-2">
                    <Checkbox
                      id={`sup-${name}`}
                      checked={confirmed.includes(name)}
                      onCheckedChange={(v) =>
                        setConfirmed((prev) =>
                          v ? [...prev, name] : prev.filter((n) => n !== name),
                        )
                      }
                    />
                    <Label htmlFor={`sup-${name}`}>{name}</Label>
                  </div>
                ))}
              </section>
            )}

            {r.conflicts.length > 0 && (
              <section>
                <h3 className="font-medium">Conflits de prix ({r.conflicts.length})</h3>
                <p className="text-muted-foreground">Le prix le plus haut est retenu.</p>
                <ul className="list-disc pl-5">
                  {r.conflicts.map((c) => (
                    <li key={`${c.norm_code}-${c.supplier_name}`}>
                      {c.norm_code} {c.supplier_name ? `(${c.supplier_name})` : ""} : retenu{" "}
                      {c.kept.value} € ({c.kept.source}) · autre {c.other.value} € ({c.other.source}
                      )
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex gap-2">
              <Button disabled={busy} onClick={apply}>
                Enregistrer l'import
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
