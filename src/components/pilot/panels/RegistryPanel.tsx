// Registre exhaustif des contrôles — panneau de LECTURE SEULE.
// Il affiche, pour chaque donnée exploitée par Pilot Pro : son statut explicite,
// la cause de l'écart, la preuve chiffrée, l'impact financier et l'action
// attendue. Aucun calcul métier n'est réalisé ici.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AlertTriangle, BadgeCheck, HelpCircle, MinusCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { useControlRegistry } from "@/components/pilot/useControlRegistry";
import {
  CONTROL_CAUSE_LABEL,
  CONTROL_FAMILY_LABEL,
  CONTROL_STATUS_HELP,
  CONTROL_STATUS_LABEL,
  type ControlFamily,
  type ControlStatus,
} from "@/lib/pilot-control-registry";

const TONE: Record<ControlStatus, string> = {
  certifie: "border-primary/30 bg-primary/5 text-primary",
  partiel: "border-amber-300 bg-amber-50 text-amber-800",
  a_confirmer: "border-orange-300 bg-orange-50 text-orange-800",
  non_exploitable: "border-destructive/40 bg-destructive/5 text-destructive",
  indisponible: "border-destructive/40 bg-destructive/5 text-destructive",
  non_requis: "border-border bg-muted text-muted-foreground",
  non_applicable: "border-border bg-muted text-muted-foreground",
};

function StatusIcon({ status }: { status: ControlStatus }) {
  if (status === "certifie") return <BadgeCheck className="h-3 w-3" aria-hidden />;
  if (status === "non_exploitable") return <ShieldAlert className="h-3 w-3" aria-hidden />;
  if (status === "indisponible") return <AlertTriangle className="h-3 w-3" aria-hidden />;
  if (status === "non_requis" || status === "non_applicable")
    return <MinusCircle className="h-3 w-3" aria-hidden />;
  return <HelpCircle className="h-3 w-3" aria-hidden />;
}

function StatusBadge({ status }: { status: ControlStatus }) {
  return (
    <Badge variant="outline" className={`font-normal ${TONE[status]}`} title={CONTROL_STATUS_HELP[status]}>
      <StatusIcon status={status} />
      <span className="ml-1">{CONTROL_STATUS_LABEL[status]}</span>
    </Badge>
  );
}

const euro = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

export function RegistryPanel() {
  const { report, loading, refetchAll } = useControlRegistry();
  const [family, setFamily] = useState<ControlFamily | "all">("all");
  const [status, setStatus] = useState<ControlStatus | "all">("all");

  const rows = useMemo(
    () =>
      report.results.filter(
        (r) =>
          (family === "all" || r.definition.family === family) &&
          (status === "all" || r.status === status),
      ),
    [report.results, family, status],
  );

  return (
    <div className="space-y-4">
      <Card className={report.blocking ? TONE.non_exploitable : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Registre exhaustif des contrôles
            <Badge variant="outline" className="font-normal">
              {report.counts.certifie} / {report.required} certifiés ({report.certifiedPct} %)
            </Badge>
            <Button variant="ghost" size="sm" onClick={refetchAll} disabled={loading} className="ml-auto gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Relancer les contrôles
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Chaque donnée exploitée porte un statut explicite : aucune donnée latente, aucune absence
            transformée en zéro, aucune erreur de lecture présentée comme un vide.
          </p>
          <p className="text-xs text-muted-foreground">
            Impact financier chiffré des écarts :{" "}
            <span className="font-medium text-foreground">
              {report.amountAtRisk == null ? "non mesurable" : euro(report.amountAtRisk)}
            </span>
            {report.unquantified > 0
              ? ` — ${report.unquantified} contrôle(s) sans montant mesurable (impact non chiffrable).`
              : ""}
          </p>
          {report.blocking && (
            <p className="text-xs font-medium">
              Un contrôle bloquant n'est pas certifié : aucun indicateur dépendant ne doit être
              présenté comme fiable.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {report.families.map((f) => (
          <Card key={f.family} className="cursor-pointer" onClick={() => setFamily(f.family)}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                {f.label}
                <StatusBadge status={f.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>
                {f.counts.certifie} certifié(s) · {f.counts.partiel} partiel(s) ·{" "}
                {f.counts.a_confirmer} à confirmer · {f.counts.indisponible} indisponible(s)
              </p>
              <p>
                Impact : {f.amountAtRisk == null ? "non mesurable" : euro(f.amountAtRisk)}
                {f.unquantified > 0 ? ` (+ ${f.unquantified} sans montant)` : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Filtres :</span>
        <Button variant={family === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setFamily("all")}>
          Tous les domaines
        </Button>
        {(Object.keys(CONTROL_FAMILY_LABEL) as ControlFamily[]).map((f) => (
          <Button key={f} variant={family === f ? "secondary" : "ghost"} size="sm" onClick={() => setFamily(f)}>
            {CONTROL_FAMILY_LABEL[f]}
          </Button>
        ))}
        <span className="ml-3 text-muted-foreground">Statut :</span>
        <Button variant={status === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setStatus("all")}>
          Tous
        </Button>
        {(Object.keys(CONTROL_STATUS_LABEL) as ControlStatus[]).map((s) => (
          <Button key={s} variant={status === s ? "secondary" : "ghost"} size="sm" onClick={() => setStatus(s)}>
            {CONTROL_STATUS_LABEL[s]} ({report.counts[s]})
          </Button>
        ))}
      </div>

      <Accordion type="multiple" className="space-y-2">
        {rows.map((r) => (
          <AccordionItem key={r.definition.id} value={r.definition.id} className="rounded-md border px-3">
            <AccordionTrigger className="gap-2 py-3 text-left text-sm hover:no-underline">
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <StatusBadge status={r.status} />
                <span className="font-medium">{r.definition.label}</span>
                <Badge variant="outline" className="font-normal">
                  {CONTROL_FAMILY_LABEL[r.definition.family]}
                </Badge>
                {r.status !== "certifie" && (
                  <Badge variant="outline" className="font-normal">
                    {CONTROL_CAUSE_LABEL[r.cause]}
                  </Badge>
                )}
                {r.amountFailing != null && r.amountFailing !== 0 && (
                  <span className="text-xs text-muted-foreground">{euro(r.amountFailing)}</span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-4 text-xs">
              <p className="text-sm">{r.message}</p>
              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Source contrôlée</dt>
                  <dd>
                    {r.definition.source} — {r.definition.field}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Consommateurs</dt>
                  <dd>{r.definition.consumers.join(" · ")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Période</dt>
                  <dd>{r.definition.period}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Règle de validité</dt>
                  <dd>{r.definition.validity}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Non applicable si</dt>
                  <dd>{r.definition.notApplicable}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Éléments contrôlés</dt>
                  <dd>
                    {r.analysed == null
                      ? "non mesuré"
                      : `${r.analysed} examiné(s), ${r.failing ?? "?"} en écart${
                          r.coveragePct == null ? "" : ` — ${r.coveragePct} % conformes`
                        }`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Conséquence</dt>
                  <dd>{r.definition.impact}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Indicateurs concernés</dt>
                  <dd>{r.definition.kpi.length ? r.definition.kpi.join(" · ") : "aucun"}</dd>
                </div>
              </dl>
              {r.evidence.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {r.evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              {r.status !== "certifie" && r.status !== "non_requis" && r.status !== "non_applicable" && (
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Action attendue :</span> {r.definition.action}
                  <Link to={r.definition.to} className="font-medium text-primary underline">
                    Ouvrir l'écran de traitement
                  </Link>
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
        {rows.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Aucun contrôle ne correspond à ce filtre.
          </p>
        )}
      </Accordion>
    </div>
  );
}