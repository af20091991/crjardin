from pathlib import Path

ca = Path("src/routes/_authenticated/pilot.ca.tsx")
s = ca.read_text()

old_import = '''// Taux horaire : gestion incluse / exclue (seul le dénominateur change).
import {
  gestionHoursForMonth,
  rateWithGestion,
  GESTION_MODE_HELP,
} from "@/lib/pilot-gestion-hours";
import { useGestionMode } from "@/lib/pilot-gestion-mode";
import { GestionToggle } from "@/components/pilot/GestionToggle";
import { listHours } from "@/lib/pilot-hours";'''
new_import = '''// Le temps de gestion déclaré est toujours inclus dans le taux horaire.
import { gestionHoursForMonth } from "@/lib/pilot-gestion-hours";
import { listHours } from "@/lib/pilot-hours";
import { monthlyCaHourlyRates, type CaHourlyRateMode } from "@/lib/pilot-ca-hourly-rate";'''
if old_import not in s:
    raise SystemExit("legacy hourly-rate import block not found")
s = s.replace(old_import, new_import, 1)

old_rate = '''  // Taux horaire du mois : même règle que la Vue exercice.
  // Gestion exclue  → CA du mois / heures d'intervention du mois.
  // Gestion incluse → CA du mois / (heures d'intervention + Temps gestion du mois),
  // le Temps gestion venant d'Analyse temps & rentabilité → Suivi mensuel.
  const { includeGestion } = useGestionMode();
  const hoursRowsQ = useQuery({ queryKey: ["pilot-hours", year], queryFn: () => listHours(year) });
  const gestionMois = gestionHoursForMonth(hoursRowsQ.data ?? [], month);
  const tauxMoisAffiche = rateWithGestion(mt.ventesHt, mt.hours, gestionMois, includeGestion);'''
new_rate = '''  // Taux horaire : gestion déclarée toujours incluse.
  // Prévisionnel = toutes les prestations du mois ; En cours = prestations déjà réglées.
  const [hourlyRateMode, setHourlyRateMode] = useState<CaHourlyRateMode>("previsionnel");
  const hoursRowsQ = useQuery({ queryKey: ["pilot-hours", year], queryFn: () => listHours(year) });
  const gestionMois = gestionHoursForMonth(hoursRowsQ.data ?? [], month);
  const tauxHoraires = useMemo(
    () => monthlyCaHourlyRates(entries, month, gestionMois),
    [entries, month, gestionMois],
  );
  const tauxMoisAffiche = tauxHoraires[hourlyRateMode];'''
if old_rate not in s:
    raise SystemExit("legacy hourly-rate calculation block not found")
s = s.replace(old_rate, new_rate, 1)

old_stat = '''        <StatBox
          label="Taux horaire"
          value={tauxMoisAffiche != null ? `${formatEuro(tauxMoisAffiche)}/h` : "—"}
          icon={TrendingUp}
          action={<GestionToggle />}
          title={includeGestion ? GESTION_MODE_HELP.incluse : GESTION_MODE_HELP.exclue}
        />'''
new_stat = '''        <StatBox
          label="Taux horaire"
          value={tauxMoisAffiche != null ? `${formatEuro(tauxMoisAffiche)}/h` : "—"}
          icon={TrendingUp}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => setHourlyRateMode((mode) => mode === "previsionnel" ? "en_cours" : "previsionnel")}
              title={hourlyRateMode === "previsionnel"
                ? "Afficher le taux calculé uniquement sur les interventions déjà réglées"
                : "Afficher le taux calculé sur toutes les prestations du mois"}
            >
              {hourlyRateMode === "previsionnel" ? "Prévisionnel" : "En cours"}
            </Button>
          }
          title={hourlyRateMode === "previsionnel"
            ? "Toutes les prestations du mois + temps de gestion déclaré"
            : "Prestations déjà réglées du mois + temps de gestion déclaré"}
        />'''
if old_stat not in s:
    raise SystemExit("legacy hourly-rate stat block not found")
s = s.replace(old_stat, new_stat, 1)
ca.write_text(s)

section = Path("src/components/pilot/CaSection.tsx")
ss = section.read_text()
ss = ss.replace('className="flex flex-row items-center justify-between gap-2 space-y-0 py-3"', 'className="flex flex-row items-center justify-between gap-2 space-y-0 py-2"', 1)
ss = ss.replace('className="flex items-center gap-2 text-base"', 'className="flex items-center gap-2 text-sm"', 1)
ss = ss.replace('className="flex items-center gap-2 rounded text-left font-medium hover:underline"', 'className="flex items-center gap-2 rounded text-left font-medium text-sm hover:underline"', 1)
ss = ss.replace('className="p-0 [&>div]:rounded-b-xl"', 'className="p-0 text-sm [&>div]:rounded-b-xl"', 1)
section.write_text(ss)

changelog = Path("src/lib/changelog.ts")
cs = changelog.read_text()
marker = 'export const CHANGELOG: ChangeEntry[] = [\n'
entry = '''  {
    date: "2026-09-16",
    version: "2.3.4",
    theme: "Général",
    title: "Chiffre d'affaires — lecture mensuelle simplifiée",
    details: [
      "Le taux horaire mensuel inclut systématiquement le temps de gestion déclaré, avec une lecture Prévisionnel et une lecture En cours basée sur les prestations déjà réglées.",
      "Le tableau annuel permet de masquer les investissements et ajoute une chronologie visuelle du résultat mensuel, sans modifier les calculs économiques.",
      "Les détails ventes / charges et les calculateurs sont présentés dans des encarts plus compacts.",
    ],
  },
'''
if entry not in cs:
    if marker not in cs:
        raise SystemExit("changelog marker not found")
    cs = cs.replace(marker, marker + entry, 1)
    changelog.write_text(cs)

if any(x in ca.read_text() for x in ("reporté", "reportées", "chargesFixesReportees")):
    raise SystemExit("forbidden CA presentation regression detected")
