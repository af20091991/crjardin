// Lecture du registre exhaustif des contrôles.
// Le hook ne fait que MESURER les sources existantes (comptages et montants)
// et déléguer toute qualification au moteur pur `pilot-control-registry`.
// Aucun calcul métier n'est refait ici, aucune valeur n'est inventée : une
// source non lue reste explicitement « indisponible ».
import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { usePilotIntegrity } from "@/components/pilot/usePilotIntegrity";
import { listClients } from "@/lib/clients";
import { listCeevContracts } from "@/lib/ceev";
import { buildQualityCenterReport } from "@/lib/pilot-quality-center";
import { runReferentialAudit } from "@/lib/pilot-referential";
import {
  listChargesToClassify,
  listSalesMissingTime,
  listSstMissingClient,
} from "@/lib/pilot-fix-flows";
import {
  buildRegistryReport,
  type ControlObservation,
  type RegistryReport,
} from "@/lib/pilot-control-registry";

const loadError = (q: UseQueryResult<unknown>): string | null =>
  q.isError ? ((q.error as Error)?.message ?? "Erreur de lecture inconnue") : null;

export function useControlRegistry(): {
  report: RegistryReport;
  loading: boolean;
  refetchAll: () => void;
} {
  const { report: integrity, reconciliation } = usePilotIntegrity();
  const quality = useQuery({ queryKey: ["pilot-quality-center"], queryFn: buildQualityCenterReport });
  const referential = useQuery({ queryKey: ["pilot-referential-audit"], queryFn: runReferentialAudit });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const ceev = useQuery({ queryKey: ["ceev-contracts"], queryFn: listCeevContracts });
  const charges = useQuery({ queryKey: ["fix-charges"], queryFn: listChargesToClassify });
  const salesTime = useQuery({ queryKey: ["fix-sales-time"], queryFn: listSalesMissingTime });
  const sst = useQuery({ queryKey: ["fix-sst"], queryFn: listSstMissingClient });

  const observations = useMemo<ControlObservation[]>(() => {
    const out: ControlObservation[] = [];
    const q = quality.data;
    const qErr = loadError(quality);
    const ref = referential.data;
    const refErr = loadError(referential);

    // ── Finance ─────────────────────────────────────────────────────────────
    const chargeCount = charges.data?.length ?? null;
    const chargeAmount = charges.data?.reduce((s, c) => s + c.amount, 0) ?? null;
    // « X / Y lignes » : Y est le nombre total de charges réellement examinées.
    const chargeHint = q?.domains.find((d) => d.key === "finance")?.metrics[0]?.hint ?? null;
    const chargeTotal = chargeHint
      ? Number(chargeHint.split("/")[1]?.replace(/\D/g, "") || Number.NaN)
      : Number.NaN;
    out.push({
      id: "finance.charges.classement",
      analysed: Number.isFinite(chargeTotal) ? chargeTotal : null,
      failing: chargeCount,
      amountFailing: chargeAmount,
      confirmable: (charges.data ?? []).some((c) => c.suggestion != null),
      loadError: loadError(charges) ?? qErr,
      evidence: charges.data ? [`${charges.data.length} charge(s) sans classe`] : [],
    });
    out.push({
      id: "finance.ventes.montant",
      analysed: q ? q.siteCoverage.caLines : null,
      failing: q ? 0 : null,
      amountAnalysed: ref ? ref.totals.caTotal : null,
      amountFailing: ref ? 0 : null,
      loadError: refErr ?? qErr,
      evidence: ref ? [`CA analysé : ${Math.round(ref.totals.caTotal).toLocaleString("fr-FR")} €`] : [],
    });

    // ── Temps ───────────────────────────────────────────────────────────────
    const timeRows = salesTime.data;
    out.push({
      id: "temps.vente.heures",
      analysed: q ? q.siteCoverage.caLines : null,
      failing: timeRows ? timeRows.length : null,
      amountFailing: timeRows ? timeRows.reduce((s, r) => s + r.amount, 0) : null,
      loadError: loadError(salesTime) ?? qErr,
      evidence: timeRows ? [`${timeRows.length} ligne(s) de vente sans temps`] : [],
    });
    const noType = q?.domains.find((d) => d.key === "activite")?.metrics[1];
    out.push({
      id: "temps.vente.type",
      analysed: q ? q.siteCoverage.caLines : null,
      failing: noType ? Number(noType.value) : null,
      loadError: qErr,
      evidence: noType ? [`${noType.value} ligne(s) sans type d'intervention`] : [],
    });

    // ── Référentiel clients ─────────────────────────────────────────────────
    out.push({
      id: "clients.rattachement.ca",
      analysed: ref
        ? ref.caAttachment.ok +
          ref.caAttachment.onContact +
          ref.caAttachment.onDuplicate +
          ref.caAttachment.toValidate +
          ref.caAttachment.unattached
        : null,
      failing: ref ? ref.caAttachment.unattached + ref.caAttachment.toValidate : null,
      amountFailing: ref ? ref.caAttachment.unattachedAmount : null,
      confirmable: ref ? ref.caAttachment.toValidate > 0 : false,
      loadError: refErr,
      evidence: ref
        ? [
            `${ref.caAttachment.ok} ligne(s) certifiée(s)`,
            `${ref.caAttachment.unattached} ligne(s) sans client`,
            `${ref.caAttachment.toValidate} rattachement(s) à valider`,
          ]
        : [],
    });
    out.push({
      id: "clients.certification",
      analysed: ref ? ref.totals.analysed : null,
      failing: ref ? ref.totals.analysed - ref.totals.certified : null,
      amountFailing: ref ? ref.totals.caAtRisk : null,
      confirmable: ref ? ref.totals.proposals > 0 : false,
      loadError: refErr ?? loadError(clients),
      evidence: ref ? [`${ref.totals.certified} / ${ref.totals.analysed} fiche(s) certifiée(s)`] : [],
    });
    out.push({
      id: "clients.doublons",
      analysed: ref ? ref.totals.analysed : null,
      failing: ref ? ref.totals.duplicates : null,
      confirmable: true,
      loadError: refErr,
      evidence: ref ? [`${ref.totals.duplicates} fiche(s) probablement identiques`] : [],
    });

    // ── Sites ───────────────────────────────────────────────────────────────
    const sitesMetrics = q?.domains.find((d) => d.key === "clients")?.metrics;
    out.push({
      id: "sites.rattachement",
      analysed: q ? q.siteCoverage.caLines : null,
      failing: q ? q.siteCoverage.caLines - q.siteCoverage.caLinesWithSite : null,
      amountFailing: q ? q.siteCoverage.caAmount - q.siteCoverage.caAmountWithSite : null,
      loadError: qErr,
      evidence: q ? [`Couverture analytique : ${q.siteCoverage.readiness} %`] : [],
    });
    out.push({
      id: "sites.propositions",
      analysed: sitesMetrics ? Number(sitesMetrics[1]?.value ?? 0) : null,
      failing: sitesMetrics ? Number(sitesMetrics[1]?.value ?? 0) : null,
      confirmable: true,
      loadError: qErr,
      evidence: sitesMetrics ? [`${sitesMetrics[1]?.value} proposition(s) en attente`] : [],
    });

    // ── CEEV ────────────────────────────────────────────────────────────────
    const contracts = ceev.data;
    out.push({
      id: "ceev.rattachement",
      analysed: contracts ? contracts.length : null,
      failing: contracts ? contracts.filter((c) => !c.client_id).length : null,
      amountFailing: contracts
        ? contracts.filter((c) => !c.client_id).reduce((s, c) => s + (c.pv_ht ?? 0), 0)
        : null,
      confirmable: contracts ? contracts.some((c) => !c.client_id && c.match_score != null) : false,
      loadError: loadError(ceev),
      evidence: contracts ? [`${contracts.length} contrat(s) lu(s)`] : [],
    });
    out.push({
      id: "ceev.montant",
      analysed: contracts ? contracts.length : null,
      failing: contracts ? contracts.filter((c) => !c.pv_ht || !c.year).length : null,
      loadError: loadError(ceev),
      evidence: contracts ? [`${contracts.filter((c) => !c.pv_ht).length} contrat(s) sans montant`] : [],
    });

    // ── Sous-traitance ──────────────────────────────────────────────────────
    const sstRows = sst.data;
    const sstMetrics = q?.domains.find((d) => d.key === "sst")?.metrics;
    out.push({
      id: "sst.mission.client",
      analysed: sstMetrics ? Number(sstMetrics[0]?.hint?.replace(/\D/g, "") ?? 0) : null,
      failing: sstRows ? sstRows.length : null,
      amountFailing: sstRows ? sstRows.reduce((s, r) => s + r.cost, 0) : null,
      loadError: loadError(sst) ?? qErr,
      evidence: sstRows ? [`${sstRows.length} mission(s) sans client`] : [],
    });
    out.push({
      id: "sst.mission.cout",
      analysed: sstMetrics ? Number(sstMetrics[0]?.hint?.replace(/\D/g, "") ?? 0) : null,
      failing: sstMetrics ? Number(sstMetrics[1]?.value ?? 0) : null,
      confirmable: true,
      loadError: qErr,
      evidence: sstMetrics ? [`${sstMetrics[1]?.value} mission(s) à valider`] : [],
    });

    // ── Moteurs ─────────────────────────────────────────────────────────────
    const rows = reconciliation.rows ?? null;
    out.push({
      id: "moteurs.reconciliation",
      analysed: rows ? rows.length : null,
      failing: rows ? rows.filter((r) => r.status !== "certifie").length : null,
      amountFailing: rows
        ? rows
            .filter((r) => r.status !== "certifie" && r.unit === "€")
            .reduce((s, r) => s + Math.abs(r.gap ?? 0), 0)
        : null,
      contradictory: reconciliation.blocking,
      loadError: reconciliation.status === "indisponible" ? reconciliation.message : null,
      evidence: rows ? rows.filter((r) => r.status !== "certifie").map((r) => `${r.label} — ${r.message}`) : [],
    });
    const datasets = integrity.datasets ?? null;
    const checks = datasets?.flatMap((d) => d.checks) ?? null;
    out.push({
      id: "moteurs.coherence",
      analysed: checks ? checks.length : null,
      failing: checks ? checks.filter((c) => c.status === "suspect").length : null,
      contradictory: checks ? checks.some((c) => c.status === "suspect") : false,
      loadError: integrity.status === "indisponible" ? integrity.message : null,
      evidence: datasets ? datasets.map((d) => `${d.label} : ${d.status}`) : [],
    });

    return out;
  }, [quality, referential, clients, ceev, charges, salesTime, sst, integrity, reconciliation]);

  const report = useMemo(() => buildRegistryReport(observations), [observations]);

  return {
    report,
    loading:
      quality.isLoading ||
      referential.isLoading ||
      charges.isLoading ||
      salesTime.isLoading ||
      sst.isLoading ||
      ceev.isLoading,
    refetchAll: () => {
      void quality.refetch();
      void referential.refetch();
      void charges.refetch();
      void salesTime.refetch();
      void sst.refetch();
      void ceev.refetch();
    },
  };
}