import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilePicker } from "@/components/FilePicker";
import { readAefFile } from "@/lib/predevis-catalogue-file";
import type { AefSpecies } from "@/lib/predevis-catalogue-aef";
import { loadAefProducts, saveAefChoices } from "@/lib/predevis-data";
import { supabase } from "@/integrations/supabase/client";

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

/** Catalogue AEF : pour chaque produit générique AEF, on choisit l'espèce dont le prix pro s'applique. */
export function AefCatalogue() {
  const [file, setFile] = useState<File | null>(null);
  const [species, setSpecies] = useState<{ rows: AefSpecies[]; skipped: number } | null>(null);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const { data: products = [], refetch } = useQuery({
    queryKey: ["predevis", "aef-products"],
    queryFn: loadAefProducts,
  });

  async function read(f: File) {
    setBusy(true);
    try {
      setSpecies(await readAefFile(f));
      await refetch();
      setChoices({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lecture du fichier AEF impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!species) return;
    const picked: Record<string, AefSpecies> = {};
    for (const [productId, idx] of Object.entries(choices)) {
      const sp = species.rows[idx];
      if (sp) picked[productId] = sp;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Session expirée, reconnecte-toi.");
      const res = await saveAefChoices({ choices: picked, userId });
      toast.success(`Prix AEF enregistrés pour ${res.offerCount} produit(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catalogue AEF — prix pro des petits végétaux</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <Label htmlFor="predevis-aef">
            Fichier « Disponible Pro » (onglet « Disponible alphabétique »)
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <FilePicker
              id="predevis-aef"
              accept=".xlsx,.xls"
              fileName={file?.name}
              onFile={setFile}
            />
            <Button size="sm" disabled={!file || busy} onClick={() => file && read(file)}>
              Lire le fichier
            </Button>
          </div>
        </div>

        {species && (
          <>
            <p className="text-muted-foreground">
              {species.rows.length} espèces avec prix · {species.skipped} lignes sans prix écartées.
              Pour chaque produit AEF, choisis l'espèce de référence : son prix pro HT remplace
              celui d'Henrri.
            </p>
            {products.length === 0 && (
              <p className="text-muted-foreground">Aucun produit AEF dans le catalogue.</p>
            )}
            <div className="space-y-3">
              {products.map((p) => {
                const options = species.rows
                  .map((sp, idx) => ({ sp, idx }))
                  .filter(({ sp }) => p.sizeKey != null && sp.sizeKey === p.sizeKey);
                return (
                  <div key={p.id} className="grid gap-2 sm:grid-cols-[1fr_1.5fr] sm:items-center">
                    <span className="font-medium">{p.designation}</span>
                    {p.sizeKey == null ? (
                      <span className="text-destructive">
                        Taille non reconnue : à traiter à la main
                      </span>
                    ) : (
                      <Select
                        value={choices[p.id] != null ? String(choices[p.id]) : ""}
                        onValueChange={(v) => setChoices((c) => ({ ...c, [p.id]: Number(v) }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={`Espèce (${options.length} en ${p.sizeKey})`} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map(({ sp, idx }) => (
                            <SelectItem key={idx} value={String(idx)}>
                              {sp.species} — {eur(sp.proPriceHt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
            <Button disabled={busy || Object.keys(choices).length === 0} onClick={save}>
              Enregistrer les espèces choisies
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
