import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pdfFileToWords } from "@/lib/predevis-quote-pdf";
import { parseQuote, type QuoteParse } from "@/lib/predevis-quote-parse";

const eur = (n: number | null) => (n == null ? "données insuffisantes" : `${n.toFixed(2).replace(".", ",")} €`);

export function QuoteImport() {
  const [quote, setQuote] = useState<QuoteParse | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function analyse(file: File) {
    setBusy(true);
    try {
      const words = await pdfFileToWords(file);
      const parsed = parseQuote(words);
      if (parsed.postes.length === 0) {
        toast.error("Aucun poste lu dans ce PDF. Vérifie que c'est un devis détaillé Henrri.");
      }
      setQuote(parsed);
      setFileName(file.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lecture du devis impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Devis détaillé Henrri</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".pdf"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) analyse(f);
            }}
          />
          {busy && <span className="text-muted-foreground">Lecture…</span>}
        </div>

        {quote && (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {fileName}
              {quote.devisNumber ? ` · devis n° ${quote.devisNumber}` : ""}
              {quote.totalHtDeclared != null ? ` · total HT déclaré ${eur(quote.totalHtDeclared)}` : ""}
            </p>

            {quote.warnings.length > 0 && (
              <ul className="list-disc pl-5 text-destructive">
                {quote.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            {quote.postes.map((p) => (
              <section key={p.index} className="space-y-2 rounded-md border p-3">
                <header className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">Poste {p.index} — {p.title ?? "sans titre (à nommer)"}</h3>
                  <Badge variant={p.status === "ok" ? "secondary" : "destructive"}>
                    {p.status === "ok" ? "contrôle OK" : "à vérifier"}
                  </Badge>
                  <span className="text-muted-foreground">
                    {p.rows.length} lignes · Sous Total {eur(p.subtotalHt)} · TTC {eur(p.sumTtc)}
                  </span>
                </header>
                {p.reasons.length > 0 && <p className="text-destructive">{p.reasons.join(" ")}</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1">Réf.</th>
                        <th>Désignation</th>
                        <th className="text-right">Qté</th>
                        <th className="text-right">PU HT</th>
                        <th className="text-right">HT</th>
                        <th className="text-right">TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.rows.map((r) => (
                        <tr key={r.position} className="border-t">
                          <td className="py-1 pr-2">{r.ref ?? "—"}</td>
                          <td className="pr-2">
                            {r.designation}
                            {r.continued && <Badge variant="outline" className="ml-2">suite</Badge>}
                            {r.kind === "mo" && <Badge variant="outline" className="ml-2">MO</Badge>}
                          </td>
                          <td className="text-right">{r.quantity ?? "—"}</td>
                          <td className="text-right">{eur(r.pu)}</td>
                          <td className="text-right">{eur(r.ht)}</td>
                          <td className="text-right">{eur(r.ttc)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

            {quote.orphanText.length > 0 && (
              <section>
                <h3 className="font-medium">Texte hors poste (non affecté)</h3>
                <p className="text-muted-foreground">{quote.orphanText.join(" ")}</p>
              </section>
            )}

            <Button variant="outline" size="sm" onClick={() => setQuote(null)}>
              Fermer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
