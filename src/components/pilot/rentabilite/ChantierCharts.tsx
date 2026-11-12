import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  BarChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/ui/lazy-recharts";
import { formatEuro } from "@/lib/pilot";
import { serieMensuelle, tauxParClient, type ChantierRow } from "@/lib/rentabilite-chantier";

const MOIS_COURTS = [
  "Jan",
  "Fév",
  "Mars",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

const COULEUR_CA = "hsl(var(--primary))";
const COULEUR_MARGE = "hsl(var(--foreground))";
const COULEUR_TAUX = "hsl(var(--primary))";
const COULEUR_MOYENNE = "hsl(var(--muted-foreground))";

interface Props {
  rows: ChantierRow[];
  nameOf: (clientId: string) => string;
}

/** Vues graphiques de la rentabilité : évolution mensuelle et taux horaire par client. */
export function ChantierCharts({ rows, nameOf }: Props) {
  const serie = useMemo(
    () => serieMensuelle(rows).map((p) => ({ ...p, label: MOIS_COURTS[p.month - 1] })),
    [rows],
  );
  const taux = useMemo(() => tauxParClient(rows), [rows]);
  const tauxData = useMemo(
    () => taux.points.map((p) => ({ ...p, name: nameOf(p.client_id) })),
    [taux.points, nameOf],
  );

  if (rows.length === 0) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label="Vues graphiques">
      <div className="rounded-lg border p-3">
        <h3 className="mb-2 text-sm font-bold">Évolution mensuelle : CA et marge</h3>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 1000)} k€`} />
              <Tooltip formatter={(v: number) => formatEuro(v)} />
              <Legend />
              <Bar dataKey="ca_ht" name="CA HT" fill={COULEUR_CA} radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="marge_ht"
                name="Marge HT"
                stroke={COULEUR_MARGE}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <h3 className="mb-2 text-sm font-bold">Taux horaire par client</h3>
        {tauxData.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucun chantier avec un temps de vente renseigné.
          </p>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tauxData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v} €/h`} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: number) => `${formatEuro(v)} / h`}
                  labelFormatter={(label) => String(label)}
                />
                {taux.taux_moyen != null && (
                  <ReferenceLine
                    x={taux.taux_moyen}
                    stroke={COULEUR_MOYENNE}
                    strokeDasharray="4 4"
                    label={{
                      value: `Moyenne ${formatEuro(taux.taux_moyen)}/h`,
                      fontSize: 11,
                      position: "top",
                    }}
                  />
                )}
                <Bar
                  dataKey="taux_horaire"
                  name="Taux horaire"
                  fill={COULEUR_TAUX}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Moyenne pondérée par les heures (marge totale / heures totales).
          {taux.exclus > 0 &&
            ` ${taux.exclus} chantier${taux.exclus > 1 ? "s" : ""} exclu${taux.exclus > 1 ? "s" : ""} faute de temps de vente.`}
        </p>
      </div>
    </section>
  );
}
