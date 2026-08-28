import { createFileRoute } from "@tanstack/react-router";
import { usePilotPeriod, usePilotYear } from "@/lib/pilot-mode";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCaEntries,
  createCaEntry,
  updateCaEntry,
  deleteCaEntry,
  monthTotals,
  yearTotals,
  MONTH_NAMES,
  QUARTER_OF,
  categoryTotals,
  CA_CATEGORIES,
  isRemunerationGrossed,
  type CaEntry,
  type CaKind,
  type CaCategory,
} from "@/lib/pilot-ca";
import { monthForecastHt } from "@/lib/pilot-ca-forecast";
// Taux horaire : gestion incluse / exclue (seul le dénominateur change).
import {
  gestionHoursForMonth,
  rateWithGestion,
  GESTION_MODE_HELP,
} from "@/lib/pilot-gestion-hours";
import { useGestionMode } from "@/lib/pilot-gestion-mode";
import { GestionToggle } from "@/components/pilot/GestionToggle";
import { listHours } from "@/lib/pilot-hours";

import { FixedChargesDetail } from "@/components/pilot/FixedChargesPanel";
import { formatEuro } from "@/lib/pilot";
import {
  listBillableRecommendations,
  linkRecommendationToCaEntry,
  recommendationPrice,
  type BillableRecommendation,
} from "@/lib/garden";
import { Calculators } from "@/components/pilot/Calculators";
import {
  parseCaSections,
  serializeCaSections,
  toggleCaSection,
  type CaSectionState,
  type CaSectionId,
  CA_SECTIONS_KEY,
} from "@/lib/pilot-ca-sections";
import { investmentsTotal, resultAfterInvestments } from "@/lib/pilot-ca-investments";
import { CaSection } from "@/components/pilot/CaSection";
import { ClientPicker } from "@/components/pilot/ClientPicker";
import { listClients } from "@/lib/clients";
import {
  INTERVENTION_KINDS,
  INTERVENTION_KIND_META,
  interventionKind,
  saleTimeState,
  SALE_TIME_STATE_LABEL,
  type InterventionKind,
} from "@/lib/pilot-sale-time";
import { useColumnWidths, ResizeHandle } from "@/components/pilot/ResizableColumns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
  Clock,
  PiggyBank,
  MessageSquare,
  Link2,
  Link2Off,
  Sparkles,
  ChevronDown,
  Landmark,
  Calculator,
  Sprout,
  Settings2,
  RotateCcw,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { remunerationBreakdown, SOCIAL_CONTRIBUTION_RATE } from "@/lib/pilot-fixed-charges";
import { realizedMonthLimit } from "@/lib/pilot-realized";
import { AnnualMonthsTable } from "@/components/pilot/AnnualMonthsTable";
import { updateSaleStatus } from "@/lib/pilot";
import { SALE_STATUS, SALE_STATUS_ORDER, type SaleStatus } from "@/lib/pilot-colors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/pilot/ca")({
  component: CaPage,
});

const num = (v: string) => Number(v.replace(",", ".")) || 0;

// Compatibilité de rendu : l'ancien sélecteur de densité a été retiré de l'UI,
// mais le workbench utilise encore cette classe pour sa mise en page.
const CA_DENSITY_CLASS = { normal: "", compact: "" } as const;

function StatBox({
  label,
  value,
  icon: Icon,
  tone,
  action,
  title,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
  /** Contrôle d'affichage propre à la vignette (ex. gestion incluse / exclue). */
  action?: React.ReactNode;
  title?: string;
}) {
  return (
    <Card className="p-3" title={title}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <div className={`mt-1.5 font-serif text-xl font-semibold tracking-tight ${tone ?? ""}`}>
        {value}
      </div>
      {action && <div className="mt-1.5">{action}</div>}
    </Card>
  );
}

function CaPage() {
  const qc = useQueryClient();
  const { year } = usePilotYear();
  const { period } = usePilotPeriod();
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [pending, setPending] = useState<number | null>(null);
  const [openNote, setOpenNote] = useState<Record<string, boolean>>({});
  const toggleNote = (id: string) => setOpenNote((s) => ({ ...s, [id]: !s[id] }));
  const [openFixed, setOpenFixed] = useState<Record<string, boolean>>({});
  const toggleFixed = (id: string) => setOpenFixed((s) => ({ ...s, [id]: !s[id] }));
  const [originFor, setOriginFor] = useState<CaEntry | null>(null);
  // L'ancien contrôle de densité n'est plus affiché, mais le workbench conserve
  // une valeur interne fixe afin de ne pas casser son rendu.
  const [density] = useState<"normal">("normal");
  // Encarts repliables (Ventes, Charges, Rémunération, Calculateurs) :
  // fermés par défaut, ouverture mémorisée localement pour cette page.
  const [sections, setSections] = useState<CaSectionState>({
    ventes: false,
    charges: false,
    remuneration: false,
    calculateurs: false,
  });
  useEffect(() => {
    if (typeof window !== "undefined") setSections(parseCaSections(window.localStorage.getItem(CA_SECTIONS_KEY)));
  }, []);
  const toggleSection = (id: CaSectionId) =>
    setSections((s) => {
      const next = toggleCaSection(s, id);
      try {
        window.localStorage.setItem(CA_SECTIONS_KEY, serializeCaSections(next));
      } catch {
        /* stockage indisponible : réglage valable pour la session */
      }
      return next;
    });

  const CA_PERSONALIZATION_KEY = "pilot-ca-personalization-v1";
  type CaPersonalization = {
    showAnnualSummary: boolean; showMonthlySummary: boolean; showMonthTabs: boolean;
    showStatusLegend: boolean; showTotals: boolean;
    salesColumns: { client: boolean; designation: boolean; category: boolean; type: boolean; amount: boolean; hours: boolean };
  };
  const DEFAULT_CA_PERSONALIZATION: CaPersonalization = {
    showAnnualSummary: true, showMonthlySummary: true, showMonthTabs: true, showStatusLegend: true, showTotals: true,
    salesColumns: { client: true, designation: true, category: true, type: true, amount: true, hours: true },
  };
  const loadCaPersonalization = (): CaPersonalization => {
    if (typeof window === "undefined") return DEFAULT_CA_PERSONALIZATION;
    try { const raw = JSON.parse(window.localStorage.getItem(CA_PERSONALIZATION_KEY) || "{}"); return { ...DEFAULT_CA_PERSONALIZATION, ...raw, salesColumns: { ...DEFAULT_CA_PERSONALIZATION.salesColumns, ...(raw.salesColumns || {}) } }; } catch { return DEFAULT_CA_PERSONALIZATION; }
  };
  const [personalization, setPersonalization] = useState<CaPersonalization>(DEFAULT_CA_PERSONALIZATION);
  const [personalizationOpen, setPersonalizationOpen] = useState(false);
  useEffect(() => setPersonalization(loadCaPersonalization()), []);
  const updatePersonalization = (patch: Partial<CaPersonalization>) => setPersonalization((current) => { const next = { ...current, ...patch, salesColumns: { ...current.salesColumns, ...(patch.salesColumns || {}) } }; try { window.localStorage.setItem(CA_PERSONALIZATION_KEY, JSON.stringify(next)); } catch {} return next; });
  const resetPersonalization = () => { setPersonalization(DEFAULT_CA_PERSONALIZATION); try { window.localStorage.removeItem(CA_PERSONALIZATION_KEY); } catch {} };

  const entriesQ = useQuery({ queryKey: ["pilot-ca", year], queryFn: () => listCaEntries(year) });
  const entries = entriesQ.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pilot-ca", year] });

  // Référentiel client : le client d'une ligne de vente est TOUJOURS choisi ici.
  const clientsQ = useQuery({ queryKey: ["clients-lite"], queryFn: listClients });
  const clients = useMemo(
    () => (clientsQ.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    [clientsQ.data],
  );

  // Largeurs de colonnes du tableau des ventes (ajustables à la souris).
  const salesCols = useColumnWidths("pilot-ca-ventes", {
    statut: 36,
    client: 168,
    designation: 190,
    categorie: 96,
    type: 124,
    montant: 112,
    temps: 84,
    actions: 116,
  });
  const chargeCols = useColumnWidths("pilot-ca-charges", {
    type: 190,
    designation: 240,
    montant: 130,
    actions: 84,
  });

  const createMut = useMutation({
    mutationFn: createCaEntry,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (p: { id: string; input: Partial<CaEntry> }) => updateCaEntry(p.id, p.input),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: deleteCaEntry,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: (p: { id: string; status: SaleStatus }) => updateSaleStatus(p.id, p.status),
    onSuccess: () => {
      // Le statut pilote la comptabilisation (Temps dès Facturé, CA dès Réglé) :
      // tous les écrans dérivés doivent se recalculer immédiatement.
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const monthsVisible =
    period === "exercice_complet" || !isCurrentYear ? 12 : Math.max(realizedMonthLimit(year, now), 1);

  useMemo(() => {
    if (month > monthsVisible) setMonth(monthsVisible);
  }, [monthsVisible]);

  const yt = useMemo(() => yearTotals(entries, { period }), [entries, period]);
  const mt = useMemo(() => monthTotals(entries, month, { period }), [entries, month, period]);
  // Prévisionnel total HT du mois affiché : cumul de TOUTES les lignes de vente
  // saisies sur ce mois, tous statuts confondus, dans le périmètre du mode global.
  const previsionnelHt = useMemo(
    () => monthForecastHt(entries, month, { period }),
    [entries, month, period],
  );

  // Taux horaire du mois : même règle que la Vue exercice.
  // Gestion exclue  → CA du mois / heures d'intervention du mois.
  // Gestion incluse → CA du mois / (heures d'intervention + Temps gestion du mois),
  // le Temps gestion venant d'Analyse temps & rentabilité → Suivi mensuel.
  const { includeGestion } = useGestionMode();
  const hoursRowsQ = useQuery({ queryKey: ["pilot-hours", year], queryFn: () => listHours(year) });
  const gestionMois = gestionHoursForMonth(hoursRowsQ.data ?? [], month);
  const tauxMoisAffiche = rateWithGestion(mt.ventesHt, mt.hours, gestionMois, includeGestion);

  const catTotals = useMemo(
    () => categoryTotals(entries, month, { period }),
    [entries, month, period],
  );
  // Investissements de l'exercice (hors charges d'exploitation) et résultat net après investissements.
  const yearInvestments = useMemo(
    () => investmentsTotal(entries, undefined, { period }),
    [entries, period],
  );
  const resultAfterInvest = useMemo(
    () => resultAfterInvestments(yt.benefice, yearInvestments),
    [yt.benefice, yearInvestments],
  );

  const monthRows = (kind: CaKind) => entries.filter((e) => e.month === month && e.kind === kind);
  const charges = monthRows("charge");
  const ventes = monthRows("vente");
  const remus = monthRows("remuneration");

  // Majoration active à partir d'août 2026 seulement : avant, rien ne change.
  const remuGrossed = isRemunerationGrossed(year, month);
  const remuNet = remus.length
    ? Number(remus[0].net_amount_ht ?? (remuGrossed ? 0 : remus[0].amount_ht)) || 0
    : 0;

  const addRow = (kind: CaKind) => {
    const list = monthRows(kind);
    const position = list.length ? Math.max(...list.map((r) => r.position)) + 1 : 0;
    createMut.mutate({
      year,
      month,
      kind,
      position,
      designation: "",
      category: kind === "vente" ? "AP" : null,
      amount_ht: kind === "remuneration" ? 0 : (pending ?? 0),
      net_amount_ht: kind === "remuneration" ? 0 : null,
      // Temps volontairement vide : aucune valeur n'est inventée à la création.
      hours: null,
      intervention_type: kind === "vente" ? "interne" : null,
    });
    if (pending != null) setPending(null);
  };

  const save = (id: string, input: Partial<CaEntry>) => updateMut.mutate({ id, input });

  type ChargeType = "Charge fixe" | "Achats" | "Charge chantier" | "Investissement";
  type AutoVariableCharge = "Alimentaire" | "Carburant" | "Déchèterie";

  const CHARGE_TYPE_META: Record<ChargeType, { charge_class: "fixe" | "variable" | "a_classer"; is_investment: boolean }> = {
    "Charge fixe": { charge_class: "fixe", is_investment: false },
    Achats: { charge_class: "variable", is_investment: false },
    "Charge chantier": { charge_class: "variable", is_investment: false },
    Investissement: { charge_class: "a_classer", is_investment: true },
  };

  const detectAutoVariableCharge = (designation: string | null | undefined): AutoVariableCharge | null => {
    const value = (designation ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/\b(carburant|essence|gazole|gasoil|diesel|sp95|sp98|e10|e85|adblue)\b/.test(value)) return "Carburant";
    if (/\b(dechetterie|dechet|dechets|decharge|benne|gravats|evacuation)\b/.test(value)) return "Déchèterie";
    if (/\b(alimentaire|alimentation|repas|restaurant|dejeuner|diner|nourriture|supermarche)\b/.test(value)) return "Alimentaire";
    return null;
  };

  const chargeTypeForRow = (row: CaEntry & { charge_category?: string | null; charge_class?: string | null }) => {
    if (row.is_fixed) return "Charges fixes" as const;
    if (row.is_investment) return "Charges variables · Investissement" as const;
    const current = row.charge_category;
    if (current === "Charge de fonctionnement" || current === "Achats") return "Charges variables · Achats" as const;
    if (current === "Charge chantier") return "Charges variables · Charges chantier" as const;
    const auto = detectAutoVariableCharge(row.designation);
    if (auto) return `Charges variables · ${auto}`;
    return null;
  };


  const saveChargeType = (row: CaEntry & { charge_category?: string | null; charge_class?: string | null }, type: ChargeType) => {
    const meta = CHARGE_TYPE_META[type];
    save(row.id, { charge_category: type, charge_class: meta.charge_class, is_investment: meta.is_investment });
  };


  /**
   * Saisie en net : le net est stocké tel quel (ressaisie sans dérive) et la
   * ligne porte le montant consommé par les totaux (majoré dès août 2026).
   */
  const saveRemuneration = (row: CaEntry, net: number) => {
    const amount = remuGrossed ? Math.round(remunerationBreakdown(net).total * 100) / 100 : net;
    if (net === Number(row.net_amount_ht ?? NaN) && amount === row.amount_ht) return;
    save(row.id, { net_amount_ht: net, amount_ht: amount });
  };


  return (
    <div className="space-y-5">
      {/* Exercice piloté par le sélecteur global (en-tête Pilot Pro) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-serif text-xl font-semibold">CA {year}</span>
        <div className="flex flex-wrap items-center gap-2">
          {pending != null && (
            <Badge variant="secondary" className="gap-1">
              Résultat prêt : {formatEuro(pending)} — cliquez « + Ligne »
            </Badge>
          )}
          <Sheet open={personalizationOpen} onOpenChange={setPersonalizationOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground" title="Personnaliser la page">
                <Settings2 className="h-3.5 w-3.5" /> <span>Personnaliser</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[360px] sm:w-[400px] overflow-y-auto">
              <SheetHeader><SheetTitle>Personnaliser le chiffre d'affaires</SheetTitle></SheetHeader>
              <div className="mt-5 space-y-6 text-sm">
                <section><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page</p><div className="space-y-1">
                  {([["showAnnualSummary","Synthèse annuelle"],["showMonthlySummary","Synthèse du mois"],["showMonthTabs","Navigation par mois"],["showStatusLegend","Légende des statuts"],["showTotals","Totaux du tableau"]] as const).map(([key,label]) => (
                    <label key={key} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"><span>{label}</span><input type="checkbox" checked={personalization[key]} onChange={(e) => updatePersonalization({ [key]: e.target.checked } as Partial<CaPersonalization>)} /></label>
                  ))}
                </div></section>
                <section><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Colonnes des ventes</p><div className="space-y-1">
                  {([["client","Client"],["designation","Désignation"],["category","Catégorie"],["type","Type d'intervention"],["amount","Montant HT"],["hours","Temps"]] as const).map(([key,label]) => (
                    <label key={key} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"><span>{label}</span><input type="checkbox" checked={personalization.salesColumns[key]} onChange={(e) => updatePersonalization({ salesColumns: { ...personalization.salesColumns, [key]: e.target.checked } })} /></label>
                  ))}
                  <p className="mt-2 text-xs text-muted-foreground">Masquer une colonne ne supprime aucune donnée et ne modifie aucun calcul.</p>
                </div></section>
                <Button variant="outline" size="sm" onClick={resetPersonalization}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Réinitialiser</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Synthèse annuelle */}
      {personalization.showAnnualSummary && <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <StatBox label={`CA HT ${year}`} value={formatEuro(yt.ventesHt)} icon={TrendingUp} />

        <StatBox
          label="Charges HT"
          value={formatEuro(yt.chargesHt)}
          icon={Wallet}
          tone="text-rose-600"
        />
        <StatBox
          label="Bénéfices nets"
          value={formatEuro(yt.benefice)}
          icon={PiggyBank}
          tone="text-emerald-600"
        />
        <StatBox label="Temps total" value={`${yt.hours.toLocaleString("fr-FR")} h`} icon={Clock} />
        {/* Investissements : jamais des charges d'exploitation, comptés une seule fois */}
        <StatBox
          label={`Investissements ${year}`}
          value={formatEuro(yearInvestments)}
          icon={Sprout}
        />
        <StatBox
          label="Résultat après investissements"
          value={formatEuro(resultAfterInvest)}
          icon={PiggyBank}
          tone={resultAfterInvest >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
      </div>}

      {/* Mode « année complète » : les 12 mois de l'exercice, saisies telles quelles */}
      {period === "exercice_complet" && (
        <AnnualMonthsTable entries={entries} year={year} period={period} now={now} />
      )}


      {/* Onglets mois */}
      {personalization.showMonthTabs && <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1 rounded-xl border border-border bg-card p-1">
          {MONTH_NAMES.slice(0, monthsVisible).map((name, i) => {
            const m = i + 1;
            const t = yt.months[i];
            const activeM = m === month;
            return (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={`flex min-w-[76px] flex-col items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${activeM ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"}`}
              >
                <span>{name.slice(0, 4)}</span>
                <span
                  className={`text-[10px] ${activeM ? "text-primary-foreground/80" : "text-muted-foreground/70"}`}
                >
                  {t.ventesHt ? formatEuro(t.ventesHt) : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>}

      {/* En-tête mois */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-lg font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <Badge variant="outline">Trimestre {QUARTER_OF(month)}</Badge>
      </div>
      {personalization.showMonthlySummary && <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatBox label="CA HT mois" value={formatEuro(mt.ventesHt)} icon={TrendingUp} />
        <StatBox
          label="Prévisionnel total HT — ventes du mois"
          value={formatEuro(previsionnelHt)}
          icon={Wallet}
        />

        <StatBox
          label="Charges HT"
          value={formatEuro(mt.chargesHt)}
          icon={Wallet}
          tone="text-rose-600"
        />
        <StatBox
          label="Bénéfice"
          value={formatEuro(mt.benefice)}
          icon={PiggyBank}
          tone={mt.benefice >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
        <StatBox label="Temps" value={`${mt.hours} h`} icon={Clock} />
        <StatBox
          label="Taux horaire"
          value={tauxMoisAffiche != null ? `${formatEuro(tauxMoisAffiche)}/h` : "—"}
          icon={TrendingUp}
          action={<GestionToggle />}
          title={includeGestion ? GESTION_MODE_HELP.incluse : GESTION_MODE_HELP.exclue}
        />
      </div>}

      {/*
       * Corps de saisie : VENTES en haut, CHARGES en bas.
       * Ordre DOM = ordre visuel, disposition verticale à toutes les largeurs.
       */}
      <div
        data-testid="ca-workbench"
        data-density={density}
        className={`flex flex-col gap-4 ${CA_DENSITY_CLASS[density]}`}
      >
        <div data-testid="ca-ventes-column" className="min-w-0 space-y-4">
          {/* Ventes — source de vérité unique, encart repliable */}
          <CaSection
            id="ventes"
            label="Détails des ventes"
            open={sections.ventes}
            onToggle={toggleSection}
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            accent="color-mix(in oklab, var(--pp-sales) 7%, transparent)"
            action={
              <Button size="sm" variant="outline" onClick={() => addRow("vente")}>
                <Plus className="mr-1 h-4 w-4" />
                Ligne
              </Button>
            }
          >
              <p className="px-4 pb-2 text-xs text-muted-foreground">
                Source unique de vérité économique. Chaque ligne porte le client, la prestation, le
                montant HT, le temps et le type d'intervention. Largeur des colonnes ajustable en
                glissant leur bord droit.
              </p>
              <div className="overflow-x-auto">
                <Table style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
                  <colgroup>
                    <col style={{ width: salesCols.widths.statut }} />
                    <col style={{ display: personalization.salesColumns.client ? undefined : "none", width: salesCols.widths.client }} />
                    <col style={{ display: personalization.salesColumns.designation ? undefined : "none", width: salesCols.widths.designation }} />
                    <col style={{ display: personalization.salesColumns.category ? undefined : "none", width: salesCols.widths.categorie }} />
                    <col style={{ display: personalization.salesColumns.type ? undefined : "none", width: salesCols.widths.type }} />
                    <col style={{ display: personalization.salesColumns.amount ? undefined : "none", width: salesCols.widths.montant }} />
                    <col style={{ display: personalization.salesColumns.hours ? undefined : "none", width: salesCols.widths.temps }} />
                    <col style={{ width: salesCols.widths.actions }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead />
                      <TableHead style={{ display: personalization.salesColumns.client ? undefined : "none" }} className="relative">Client
                        <ResizeHandle
                          width={salesCols.widths.client}
                          onResize={(w) => salesCols.setWidth("client", w)}
                        />
                      </TableHead>
                      <TableHead style={{ display: personalization.salesColumns.designation ? undefined : "none" }} className="relative">Désignation
                        <ResizeHandle
                          width={salesCols.widths.designation}
                          onResize={(w) => salesCols.setWidth("designation", w)}
                        />
                      </TableHead>
                      <TableHead style={{ display: personalization.salesColumns.category ? undefined : "none" }} className="relative">Catégorie
                        <ResizeHandle
                          width={salesCols.widths.categorie}
                          onResize={(w) => salesCols.setWidth("categorie", w)}
                        />
                      </TableHead>
                      <TableHead style={{ display: personalization.salesColumns.type ? undefined : "none" }} className="relative">Type d'intervention
                        <ResizeHandle
                          width={salesCols.widths.type}
                          onResize={(w) => salesCols.setWidth("type", w)}
                        />
                      </TableHead>
                      <TableHead style={{ display: personalization.salesColumns.amount ? undefined : "none" }} className="relative text-right">Montant HT
                        <ResizeHandle
                          width={salesCols.widths.montant}
                          onResize={(w) => salesCols.setWidth("montant", w)}
                        />
                      </TableHead>
                      <TableHead style={{ display: personalization.salesColumns.hours ? undefined : "none" }} className="relative text-right">Temps
                        <ResizeHandle
                          width={salesCols.widths.temps}
                          onResize={(w) => salesCols.setWidth("temps", w)}
                        />
                      </TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventes.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={2 + Object.values(personalization.salesColumns).filter(Boolean).length}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          Aucune vente — ajoutez une ligne
                        </TableCell>
                      </TableRow>
                    )}
                    {ventes.map((row) => {
                      const hasNote = !!row.note;
                      // Commentaire replié par défaut : aucune donnée perdue,
                      // ouverture en un clic via « Voir le commentaire ».
                      const opened = !!openNote[row.id];
                      const status = ((row.sale_status as SaleStatus | undefined) ??
                        "realise") as SaleStatus;
                      const kind = interventionKind(row.intervention_type);
                      const timeState = saleTimeState(row);
                      return (
                        <Fragment key={row.id}>
                          <TableRow className={SALE_STATUS[status].row}>
                            <TableCell className="pr-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    title={SALE_STATUS[status].label}
                                    className={`h-3.5 w-3.5 rounded-full ${SALE_STATUS[status].dot}`}
                                  />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  {SALE_STATUS_ORDER.map((s) => (
                                    <DropdownMenuItem
                                      key={s}
                                      onClick={() => statusMut.mutate({ id: row.id, status: s })}
                                      className="gap-2"
                                    >
                                      <span
                                        className={`h-2.5 w-2.5 rounded-full ${SALE_STATUS[s].dot}`}
                                      />
                                      {SALE_STATUS[s].label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                            <TableCell style={{ display: personalization.salesColumns.client ? undefined : "none" }}>
                              <ClientPicker
                                clients={clients}
                                value={row.client_id ?? ""}
                                onChange={(id) => save(row.id, { client_id: id })}
                                placeholder="Client…"
                              />
                            </TableCell>
                            <TableCell style={{ display: personalization.salesColumns.designation ? undefined : "none" }}>
                              <Input
                                defaultValue={row.designation ?? ""}
                                placeholder="Désignation"
                                title={row.designation ?? undefined}
                                className="h-8 w-full border-transparent bg-transparent hover:border-input focus:border-input"
                                onBlur={(e) => {
                                  if (e.target.value !== (row.designation ?? ""))
                                    save(row.id, { designation: e.target.value });
                                }}
                              />
                            </TableCell>
                            <TableCell style={{ display: personalization.salesColumns.category ? undefined : "none" }}>
                              <Select
                                value={row.category ?? "AP"}
                                onValueChange={(v) => save(row.id, { category: v as CaCategory })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CA_CATEGORIES.map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell style={{ display: personalization.salesColumns.type ? undefined : "none" }}>
                              <Select
                                value={kind}
                                onValueChange={(v) =>
                                  save(row.id, { intervention_type: v as InterventionKind })
                                }
                              >
                                <SelectTrigger
                                  className="h-8"
                                  title={INTERVENTION_KIND_META[kind].help}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {INTERVENTION_KINDS.map((k) => (
                                    <SelectItem key={k} value={k}>
                                      {INTERVENTION_KIND_META[k].label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right" style={{ display: personalization.salesColumns.amount ? undefined : "none" }}>
                              <Input
                                defaultValue={row.amount_ht || ""}
                                type="number"
                                inputMode="decimal"
                                className="h-8 text-right"
                                onBlur={(e) => {
                                  const v = num(e.target.value);
                                  if (v !== row.amount_ht) save(row.id, { amount_ht: v });
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right" style={{ display: personalization.salesColumns.hours ? undefined : "none" }}>
                              <Input
                                defaultValue={row.hours == null ? "" : String(row.hours)}
                                type="number"
                                inputMode="decimal"
                                placeholder={kind === "sst" ? "0" : "—"}
                                title={SALE_TIME_STATE_LABEL[timeState]}
                                className={`h-8 text-right ${timeState === "absent" ? "border-amber-300 bg-amber-50/60" : ""}`}
                                onBlur={(e) => {
                                  const raw = e.target.value.trim();
                                  const v = raw === "" ? null : num(raw);
                                  if (v !== (row.hours ?? null)) save(row.id, { hours: v });
                                }}
                              />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Button
                                size="icon"
                                variant="ghost"
                                className={`h-8 w-8 ${row.client_id ? "text-primary" : "text-muted-foreground"}`}
                                title={
                                  row.client_id
                                    ? "Rattachée à une recommandation"
                                    : "Rattacher à une recommandation"
                                }
                                onClick={() => setOriginFor(row)}
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className={`h-8 w-8 ${hasNote ? "text-primary" : "text-muted-foreground"}`}
                                title={hasNote ? "Voir le commentaire" : "Ajouter un commentaire"}
                                onClick={() => toggleNote(row.id)}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                onClick={() => deleteMut.mutate(row.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {hasNote && !opened && (
                            <TableRow>
                              <TableCell colSpan={2 + Object.values(personalization.salesColumns).filter(Boolean).length} className="py-1">
                                <button
                                  type="button"
                                  className="text-xs font-medium text-primary hover:underline"
                                  onClick={() => toggleNote(row.id)}
                                >
                                  Voir le commentaire
                                </button>
                              </TableCell>
                            </TableRow>
                          )}
                          {opened && (
                            <TableRow>
                              <TableCell colSpan={2 + Object.values(personalization.salesColumns).filter(Boolean).length} className="bg-muted/20 py-2">
                                <Textarea
                                  defaultValue={row.note ?? ""}
                                  placeholder="Commentaire (optionnel)…"
                                  className="min-h-[60px] text-sm"
                                  onBlur={(e) => {
                                    const v = e.target.value;
                                    if (v !== (row.note ?? "")) save(row.id, { note: v });
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {ventes.length > 0 && personalization.showStatusLegend && (
                <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
                  <span className="uppercase tracking-wide">Statut :</span>
                  {SALE_STATUS_ORDER.map((s) => (
                    <span key={s} className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${SALE_STATUS[s].dot}`} />
                      {SALE_STATUS[s].label}
                    </span>
                  ))}
                  <span className="ml-auto">
                    Type SST : un temps de 0 h est une valeur valide. Case ambrée = temps non
                    renseigné.
                  </span>
                </div>
              )}
              {personalization.showTotals && <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm">
                <span className="font-medium">Total CA HT {MONTH_NAMES[month - 1]}</span>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">{mt.hours} h</span>
                  <span className="font-semibold text-emerald-600">{formatEuro(mt.ventesHt)}</span>
                </div>
              </div>}
              {catTotals.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t px-4 py-2.5">
                  {catTotals.map((c) => (
                    <Badge key={c.category} variant="secondary" className="gap-1 font-normal">
                      {c.category} · {formatEuro(c.ht)}
                      {c.hours ? ` · ${c.hours} h` : ""}
                    </Badge>
                  ))}
                </div>
              )}
          </CaSection>
        </div>
        <div data-testid="ca-charges-column" className="min-w-0 space-y-4">
          {/* Charges d'exploitation — encart repliable, sous les ventes */}
          <CaSection
            id="charges"
            label="Détails des charges"
            open={sections.charges}
            onToggle={toggleSection}
            icon={<Wallet className="h-4 w-4 text-rose-600" />}
            accent="color-mix(in oklab, var(--pp-charges) 7%, transparent)"
            action={
              <Button size="sm" variant="outline" onClick={() => addRow("charge")}>
                <Plus className="mr-1 h-4 w-4" />
                Ligne
              </Button>
            }
          >
              <div className="overflow-x-auto">
                <Table style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
                  <colgroup>
                    <col style={{ width: chargeCols.widths.designation }} />
                    <col style={{ width: chargeCols.widths.type }} />
                    <col style={{ width: chargeCols.widths.montant }} />
                    <col style={{ width: chargeCols.widths.actions }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="relative">
                        Désignation
                        <ResizeHandle
                          width={chargeCols.widths.designation}
                          onResize={(w) => chargeCols.setWidth("designation", w)}
                        />
                      </TableHead>
                      <TableHead className="relative">
                        Type de charge
                        <ResizeHandle
                          width={chargeCols.widths.type}
                          onResize={(w) => chargeCols.setWidth("type", w)}
                        />
                      </TableHead>
                      <TableHead className="relative text-right">
                        Montant HT
                        <ResizeHandle
                          width={chargeCols.widths.montant}
                          onResize={(w) => chargeCols.setWidth("montant", w)}
                        />
                      </TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {charges.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          Aucune charge — ajoutez une ligne
                        </TableCell>
                      </TableRow>
                    )}
                    {charges.map((row) => {
                      const hasNote = !!row.note;
                      // Commentaire replié par défaut : aucune donnée perdue,
                      // ouverture en un clic via « Voir le commentaire ».
                      const opened = !!openNote[row.id];
                      // Ligne « Charges fixes » : son montant est la somme du
                      // détail (pilot_fixed_charges), jamais ressaisi à part.
                      const isFixed = !!row.is_fixed;
                      const fixedOpen = !!openFixed[row.id];
                      return (
                        <Fragment key={row.id}>
                          <TableRow>
                            <TableCell>
                              {isFixed ? (
                                <button
                                  type="button"
                                  data-testid="ca-fixed-row-toggle"
                                  className="flex h-8 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                                  onClick={() => toggleFixed(row.id)}
                                >
                                  <ChevronDown
                                    className={`h-4 w-4 transition-transform ${fixedOpen ? "" : "-rotate-90"}`}
                                  />
                                  {row.designation || "Charges fixes"}
                                </button>
                              ) : (
                                <Input
                                  defaultValue={row.designation ?? ""}
                                  placeholder="Désignation"
                                  title={row.designation ?? undefined}
                                  className="h-8 w-full border-transparent bg-transparent hover:border-input focus:border-input"
                                  onBlur={(e) => {
                                    if (e.target.value !== (row.designation ?? ""))
                                      save(row.id, { designation: e.target.value });
                                  }}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {isFixed ? (
                                <span className="text-sm font-medium text-muted-foreground">Charge fixe</span>
                              ) : (() => {
                                const typedRow = row as CaEntry & { charge_category?: string | null; charge_class?: string | null };
                                const selectedType = chargeTypeForRow(typedRow);
                                const autoVariable = detectAutoVariableCharge(row.designation);
                                return (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button type="button" className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-left text-sm hover:bg-muted/40">
                                        <span className={selectedType ? "" : "text-muted-foreground"}>{selectedType ?? "Choisir…"}</span>
                                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-64">
                                      <DropdownMenuItem title="Charges récurrentes de structure : le détail est saisi dans la ligne « Charges fixes »." onSelect={() => saveChargeType(typedRow, "Charge fixe")}>Charges fixes</DropdownMenuItem>
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>Charges variables</DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="w-72">
                                          <div className="px-2 py-1.5 text-xs text-muted-foreground">Alimentaire, carburant et déchèterie sont détectés automatiquement d'après la désignation.</div>
                                          <DropdownMenuSeparator />
                                          {autoVariable && <div className="px-2 py-1.5 text-xs text-muted-foreground">Détection actuelle : <span className="font-medium text-foreground">{autoVariable}</span></div>}
                                          <DropdownMenuItem title="Toutes les charges nécessaires au fonctionnement de l'entreprise, autre que les charges de chantier" onSelect={() => saveChargeType(typedRow, "Achats")}>Achats</DropdownMenuItem>
                                          <DropdownMenuItem title="Charges directement liées à la réalisation d'un chantier." onSelect={() => saveChargeType(typedRow, "Charge chantier")}>Charges chantier</DropdownMenuItem>
                                          <DropdownMenuItem title="Apparaît dans le mois en cours mais n'impacte pas le résultat du mois. L'investissement est rapporté à l'exercice, pas au mois auquel il a été affecté." onSelect={() => saveChargeType(typedRow, "Investissement")}>Investissement</DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>

                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                );
                              })()}
                            </TableCell>

                            <TableCell className="text-right">
                              {isFixed ? (
                                <span
                                  data-testid="ca-fixed-row-amount"
                                  className="block px-3 text-sm font-semibold"
                                  title="Somme du détail des charges fixes"
                                >
                                  {formatEuro(row.amount_ht)}
                                </span>
                              ) : (
                                <Input
                                  defaultValue={row.amount_ht || ""}
                                  type="number"
                                  inputMode="decimal"
                                  className="h-8 text-right"
                                  onBlur={(e) => {
                                    const v = num(e.target.value);
                                    if (v !== row.amount_ht) save(row.id, { amount_ht: v });
                                  }}
                                />
                              )}
                            </TableCell>

                            <TableCell className="whitespace-nowrap">
                              <Button
                                size="icon"
                                variant="ghost"
                                className={`h-8 w-8 ${hasNote ? "text-primary" : "text-muted-foreground"}`}
                                title={hasNote ? "Voir le commentaire" : "Ajouter un commentaire"}
                                onClick={() => toggleNote(row.id)}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                onClick={() => deleteMut.mutate(row.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isFixed && fixedOpen && (
                            <TableRow>
                              <TableCell colSpan={4} className="py-2">
                                <FixedChargesDetail
                                  caEntryId={row.id}
                                  year={year}
                                  onSumChange={(sum) => {
                                    if (sum !== row.amount_ht) save(row.id, { amount_ht: sum });
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                          {hasNote && !opened && (

                            <TableRow>
                              <TableCell colSpan={4} className="py-1">
                                <button
                                  type="button"
                                  className="text-xs font-medium text-primary hover:underline"
                                  onClick={() => toggleNote(row.id)}
                                >
                                  Voir le commentaire
                                </button>
                              </TableCell>
                            </TableRow>
                          )}
                          {opened && (
                            <TableRow>
                              <TableCell colSpan={4} className="bg-muted/20 py-2">
                                <Textarea
                                  defaultValue={row.note ?? ""}
                                  placeholder="Commentaire (optionnel)…"
                                  className="min-h-[60px] text-sm"
                                  onBlur={(e) => {
                                    const v = e.target.value;
                                    if (v !== (row.note ?? "")) save(row.id, { note: v });
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm">
                <span className="font-medium">Total charges {MONTH_NAMES[month - 1]}</span>
                <span className="font-semibold text-rose-600">{formatEuro(mt.chargesHt)}</span>
              </div>
          </CaSection>

          {/*
           * Rémunération — encart unique et repliable, placé APRÈS les charges.
           * Saisie en net ; à partir d'août 2026 la ligne stocke le total
           * majoré (net + cotisations) et le net reste conservé à part.
           */}
          <div data-testid="ca-remuneration-card">
            <CaSection
              id="remuneration"
              label={`Rémunération ${MONTH_NAMES[month - 1]}`}
              open={sections.remuneration}
              onToggle={toggleSection}
              icon={<Landmark className="h-4 w-4 text-primary" />}
              action={
                remus.length === 0 ? (
                  <Button size="sm" variant="outline" onClick={() => addRow("remuneration")}>
                    <Plus className="mr-1 h-4 w-4" />
                    Définir
                  </Button>
                ) : undefined
              }
            >
              <div className="space-y-2 p-4">
                {remus.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune rémunération saisie pour ce mois.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm">Rémunération nette</span>
                      <Input
                        key={remus[0].id + remuNet}
                        defaultValue={remuNet || ""}
                        type="number"
                        inputMode="decimal"
                        className="h-8 w-32 text-right"
                        onBlur={(e) => saveRemuneration(remus[0], num(e.target.value))}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteMut.mutate(remus[0].id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <RemunerationBreakdown net={remuNet} />
                    {remuGrossed && (
                      <p className="text-xs text-muted-foreground">
                        La ligne enregistrée vaut {formatEuro(remus[0].amount_ht)} (coût total
                        majoré).
                      </p>
                    )}
                  </>
                )}
              </div>
            </CaSection>
          </div>

          {/* Calculateurs — dernier encart, repliable */}
          <CaSection
            id="calculateurs"
            label="Calculateurs"
            open={sections.calculateurs}
            onToggle={toggleSection}
            icon={<Calculator className="h-4 w-4 text-primary" />}
          >
            <div className="p-4">
              <Calculators
                onUse={(v) => {
                  setPending(v);
                  toast.success(`Résultat prêt : ${formatEuro(v)}`);
                }}
              />
            </div>
          </CaSection>

          {/*
           * Panneau « charges fixes » legacy retiré (audit V2.3+, anomalie 3) :
           * source unique désormais : pilot_ca_entries.
           */}
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
            Source unique des charges : le classeur CA / charges ci-dessus. L'ancien tableau de
            charges fixes mensuelles a été retiré pour éviter tout double comptage.
          </p>
        </div>
      </div>

      <OriginDialog
        entry={originFor}
        onClose={() => setOriginFor(null)}
        onLinked={(clientId) => {
          if (originFor) save(originFor.id, { client_id: clientId });
          qc.invalidateQueries({ queryKey: ["recommendations-funnel"] });
          qc.invalidateQueries({ queryKey: ["recommendations-funnel-ca"] });
          setOriginFor(null);
        }}
      />
    </div>
  );
}

/** Décomposition net / cotisations / coût total d'une rémunération mensuelle. */
function RemunerationBreakdown({ net }: { net: number }) {
  const b = remunerationBreakdown(net);
  return (
    <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Net</span>
        <span>{formatEuro(b.net)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          Cotisations sociales ({Math.round(SOCIAL_CONTRIBUTION_RATE * 100)} %)
        </span>
        <span>{formatEuro(b.social)}</span>
      </div>
      <div className="flex items-center justify-between border-t pt-1 font-semibold">
        <span>Coût total</span>
        <span className="text-rose-600">{formatEuro(b.total)}</span>
      </div>
    </div>
  );
}

function OriginDialog({
  entry,
  onClose,
  onLinked,
}: {
  entry: CaEntry | null;
  onClose: () => void;
  onLinked: (clientId: string) => void;
}) {
  const open = !!entry;
  const [origin, setOrigin] = useState<"none" | "reco">("none");
  const [recoId, setRecoId] = useState<string>("");

  const recosQ = useQuery({
    queryKey: ["billable-recommendations"],
    queryFn: listBillableRecommendations,
    enabled: open && origin === "reco",
  });

  const linkMut = useMutation({
    mutationFn: async (r: BillableRecommendation) => {
      if (!entry) throw new Error("Ligne CA introuvable");
      await linkRecommendationToCaEntry(r.id, entry.id);
      return r.client_id;
    },
    onSuccess: (clientId) => {
      toast.success("Recommandation facturée");
      onLinked(clientId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setOrigin("none");
          setRecoId("");
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Origine commerciale</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Origine</label>
            <Select value={origin} onValueChange={(v) => setOrigin(v as "none" | "reco")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                <SelectItem value="reco">Recommandation client</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {origin === "reco" && (
            <div>
              <label className="text-sm font-medium">Recommandation planifiée</label>
              {recosQ.isLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Chargement…</p>
              ) : (recosQ.data?.length ?? 0) === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Aucune recommandation planifiée en attente de facturation.
                </p>
              ) : (
                <div className="mt-1 max-h-64 space-y-1 overflow-auto rounded-md border p-1">
                  {recosQ.data!.map((r) => {
                    const price = recommendationPrice(r);
                    const sel = r.id === recoId;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setRecoId(r.id)}
                        className={`flex w-full items-start justify-between gap-2 rounded px-2.5 py-2 text-left text-sm transition-colors ${sel ? "bg-primary/10" : "hover:bg-accent/40"}`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{r.title}</p>
                          <p className="text-xs text-muted-foreground">
                            <Sparkles className="mr-1 inline h-3 w-3" />
                            {r.client_name}
                            {r.category ? ` · ${r.category}` : ""}
                          </p>
                        </div>
                        {price != null && (
                          <span className="whitespace-nowrap text-xs font-semibold text-primary">
                            {formatEuro(price)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              setOrigin("none");
              setRecoId("");
            }}
          >
            <Link2Off className="mr-1.5 h-4 w-4" />
            Annuler
          </Button>
          <Button
            disabled={origin !== "reco" || !recoId || linkMut.isPending}
            onClick={() => {
              const r = recosQ.data?.find((x) => x.id === recoId);
              if (r) linkMut.mutate(r);
            }}
          >
            Rattacher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
