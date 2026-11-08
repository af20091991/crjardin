import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PosteFinance } from "@/lib/predevis-finance";
import { amount, copyText, eur } from "@/components/predevis/predevis-format";

/** Une ligne du tableau d'un poste. Le rattachement et l'achat sont déjà mis en forme par l'écran appelant. */
export type ViewRow = {
  key: string;
  ref: string | null;
  designation: string;
  kind: "fourniture" | "mo";
  continued: boolean;
  quantity: number | null;
  pu: number | null;
  ht: number | null;
  ttc: number | null;
  pau: ReactNode;
  rattachement: ReactNode;
  /** Champs de saisie à la place des montants, en mode modification. */
  editable?: { quantity: ReactNode; pu: ReactNode; ht: ReactNode; ttc: ReactNode };
};

export function PosteSection({
  index,
  title,
  meta,
  rows,
  fin,
  clientText,
  children,
}: {
  index: number;
  title: string;
  meta?: ReactNode;
  rows: ViewRow[];
  fin: PosteFinance;
  clientText: string;
  children?: ReactNode;
}) {
  return (
    <section className="space-y-6 rounded-xl border bg-card p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h3 className="font-display text-lg">
          Poste {index} — {title}
        </h3>
        {meta}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 text-left font-medium">Réf.</th>
              <th className="py-2 pr-4 text-left font-medium">Désignation</th>
              <th className="py-2 pr-4 text-right font-medium">Qté</th>
              <th className="py-2 pr-4 text-right font-medium">PAU HT détecté</th>
              <th className="py-2 pr-4 text-right font-medium">PU HT</th>
              <th className="py-2 pr-4 text-right font-medium">HT</th>
              <th className="py-2 pr-4 text-right font-medium">TTC</th>
              <th className="py-2 text-right font-medium">Rattachement catalogue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b last:border-0 hover:bg-muted/40">
                <td className="py-3 pr-4 text-muted-foreground">{r.ref ?? "—"}</td>
                <td className="py-3 pr-4">
                  {r.designation}
                  {r.continued && (
                    <Badge variant="outline" className="ml-2">
                      suite
                    </Badge>
                  )}
                  {r.kind === "mo" && (
                    <Badge variant="outline" className="ml-2">
                      MO
                    </Badge>
                  )}
                </td>
                <td className="py-3 pr-4 text-right">
                  {r.editable?.quantity ?? r.quantity ?? "—"}
                </td>
                <td className="py-3 pr-4 text-right">{r.pau}</td>
                <td className="py-3 pr-4 text-right">{r.editable?.pu ?? eur(r.pu)}</td>
                <td className="py-3 pr-4 text-right">{r.editable?.ht ?? eur(r.ht)}</td>
                <td className="py-3 pr-4 text-right">{r.editable?.ttc ?? eur(r.ttc)}</td>
                <td className="py-3 text-right">
                  <div className="flex justify-end">{r.rattachement}</div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/60 text-base font-semibold">
              <td className="py-3 pr-4" colSpan={3}>
                Total poste {index}
              </td>
              <td className="py-3 pr-4 text-right">{eur(fin.achatFournituresHt)}</td>
              <td className="py-3 pr-4" />
              <td className="py-3 pr-4 text-right">{eur(fin.pvHt)}</td>
              <td className="py-3 pr-4 text-right">{eur(fin.pvTtc)}</td>
              <td className="py-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border p-4">
          <RecapLine label="PV HT" value={eur(fin.pvHt)} />
          <RecapLine
            label="PV TTC"
            value={eur(fin.pvTtc)}
            copy={amount(fin.pvTtc)}
            copyLabel="PV TTC"
          />
          <RecapLine
            label="PAU HT (fournitures)"
            value={eur(fin.achatFournituresHt)}
            copy={amount(fin.achatFournituresHt)}
            copyLabel="PAU HT"
          />
          <RecapLine label="Prix de revient HT (fournitures + MO)" value={eur(fin.prixAchatHt)} />
          <RecapLine label="Marge nette HT" value={eur(fin.margeHt)} strong />
          <RecapLine
            label="Taux de marge"
            value={fin.tauxMarge == null ? "—" : `${fin.tauxMarge.toFixed(2).replace(".", ",")} %`}
            strong
          />
          {fin.issues.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Calcul sur les lignes renseignées : {fin.issues.length} information
              {fin.issues.length > 1 ? "s" : ""} à compléter ci-dessous.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-lg bg-muted/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">Texte client</span>
            <Button
              size="sm"
              variant="outline"
              disabled={!clientText}
              onClick={() => copyText(clientText, "Texte client")}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              Copier le texte
            </Button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {clientText || "—"}
          </pre>
        </div>
      </div>

      {children}
    </section>
  );
}

function RecapLine({
  label,
  value,
  copy,
  copyLabel,
  strong,
}: {
  label: string;
  value: string;
  copy?: string | null;
  copyLabel?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="min-w-0 flex-1 text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
      {copy != null && copyLabel && (
        <Button size="sm" variant="outline" onClick={() => copyText(copy, copyLabel)}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          Copier
        </Button>
      )}
    </div>
  );
}
