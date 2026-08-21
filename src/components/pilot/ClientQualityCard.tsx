// Bloc « Qualité de la fiche » transformé en assistant d'action immédiate.
// RÈGLE : computeClientQuality() reste la seule source de vérité des manques —
// rien n'est recalculé ici. Les écritures passent par updateCell() (journalisé,
// annulable) ou par EntityStatusQuickEdit pour le référentiel.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClipboardCheck, ArrowRight, Wrench, Loader2, CheckCircle2 } from "lucide-react";
import { computeClientQuality, type ClientQualityInput } from "@/lib/client-quality";
import {
  qualityActions,
  progressLabel,
  type QualityAction,
  type SimpleField,
} from "@/lib/client-quality-actions";
import { datasetById, updateCell } from "@/lib/pilot-edit";
import {
  REPORT_POLICY_META,
  LIFECYCLE_META,
  type ReportPolicy,
  type ClientLifecycle,
} from "@/lib/clients";
import { EntityStatusQuickEdit } from "@/components/pilot/rentabilite/EntityStatusQuickEdit";
import type { EntityStatus } from "@/lib/pilot-referential";
import { useRole } from "@/hooks/use-role";

export interface QualityClientFields {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  report_policy: ReportPolicy;
  lifecycle_status: ClientLifecycle;
}

const FIELD_LABEL: Record<SimpleField, string> = {
  address: "Adresse",
  phone: "Téléphone",
  email: "E-mail",
  report_policy: "Politique de compte-rendu",
  lifecycle_status: "Cycle de vie",
  entity_status: "Statut du référentiel",
};

export function ClientQualityCard({
  clientId,
  input,
  details,
  client,
  entityStatus,
}: {
  clientId: string;
  input: ClientQualityInput;
  details: Array<{ label: string; value: string }>;
  client?: QualityClientFields;
  entityStatus?: EntityStatus;
}) {
  const q = computeClientQuality(input, clientId);
  const actions = useMemo(() => qualityActions(q.gaps), [q.gaps]);
  const { canEdit } = useRole();

  // Avant / après : la complétude n'est jamais recalculée ici, elle est
  // simplement comparée à la valeur observée avant la correction.
  const [pendingBefore, setPendingBefore] = useState<number | null>(null);
  const [delta, setDelta] = useState<{ before: number; after: number } | null>(null);
  useEffect(() => {
    if (pendingBefore != null && pendingBefore !== q.completeness) {
      setDelta({ before: pendingBefore, after: q.completeness });
      setPendingBefore(null);
    }
  }, [pendingBefore, q.completeness]);

  return (
    <Card data-testid="client-quality-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Qualité de la fiche
          <Badge variant="outline" className={`ml-auto text-[10px] ${q.levelBadge}`}>
            {q.levelLabel}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Confiance {q.confidenceLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span data-testid="quality-progress" className="text-muted-foreground">
              {progressLabel(actions)}
            </span>
            <span className="font-semibold tabular-nums">{q.completeness} %</span>
          </div>
          <Progress value={q.completeness} className="h-1.5" />
          <p className="mt-1 text-xs text-muted-foreground">
            {q.attachedCount} élément(s) associé(s) ·{" "}
            {q.lastQualifiedAt
              ? `dernière qualification le ${new Date(q.lastQualifiedAt).toLocaleDateString("fr-FR")}`
              : "aucune qualification manuelle enregistrée"}
          </p>
          {delta && (
            <p
              data-testid="quality-delta"
              className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complétude {delta.before} % → {delta.after} % après correction
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {details.map((d) => (
            <div key={d.label} className="rounded-md border bg-muted/30 px-2.5 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.label}</p>
              <p className="text-sm font-medium tabular-nums">{d.value}</p>
            </div>
          ))}
        </div>

        {/* Décisions du dirigeant toujours corrigeables en deux clics. */}
        {canEdit && client && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-2.5 py-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Corrections rapides
            </span>
            <FixPopover
              clientId={clientId}
              client={client}
              fields={["report_policy"]}
              triggerLabel={REPORT_POLICY_META[client.report_policy].short}
              onBeforeSave={() => setPendingBefore(q.completeness)}
            />
            <FixPopover
              clientId={clientId}
              client={client}
              fields={["lifecycle_status"]}
              triggerLabel={LIFECYCLE_META[client.lifecycle_status].label}
              onBeforeSave={() => setPendingBefore(q.completeness)}
            />
            <EntityStatusQuickEdit
              clientId={clientId}
              clientName={client.name}
              status={entityStatus ?? "manual_review_required"}
            />
          </div>
        )}

        {actions.length > 0 && (
          <ul className="space-y-2" data-testid="quality-actions">
            {actions.map((a) => (
              <li key={a.key} className="rounded-md border p-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.target}</p>
                    <p className="text-xs text-muted-foreground">{a.explain}</p>
                    <p className="text-xs text-muted-foreground">Impact : {a.impact}</p>
                  </div>
                  {a.kind === "simple" && canEdit && client ? (
                    <FixPopover
                      clientId={clientId}
                      client={client}
                      fields={a.fields ?? []}
                      triggerLabel={a.cta}
                      primary
                      onBeforeSave={() => setPendingBefore(q.completeness)}
                    />
                  ) : (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 px-2 text-xs"
                    >
                      <Link
                        to="/pilot/controle"
                        search={{
                          section: (a.control?.section ?? "actions") as never,
                          sub: a.control?.sub,
                          client: clientId,
                        }}
                      >
                        {a.cta} <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Correction en deux clics : « Corriger » puis « Enregistrer ». Chaque champ
 * modifié est écrit via updateCell() → journalisé dans pilot_edit_log et
 * annulable. Une valeur laissée vide n'écrase jamais une donnée existante.
 */
function FixPopover({
  clientId,
  client,
  fields,
  triggerLabel,
  primary,
  onBeforeSave,
}: {
  clientId: string;
  client: QualityClientFields;
  fields: SimpleField[];
  triggerLabel: string;
  primary?: boolean;
  onBeforeSave: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    address: client.address ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    report_policy: client.report_policy,
    lifecycle_status: client.lifecycle_status,
  });

  const mut = useMutation({
    mutationFn: async () => {
      const def = datasetById("clients");
      const row: Record<string, unknown> = {
        id: clientId,
        name: client.name,
        address: client.address,
        phone: client.phone,
        email: client.email,
        report_policy: client.report_policy,
        lifecycle_status: client.lifecycle_status,
      };
      for (const f of fields) {
        if (f === "entity_status") continue;
        const raw = (values[f] ?? "").trim();
        // Champ laissé vide : on ne remplace jamais une donnée par du vide.
        if (!raw) continue;
        await updateCell({
          def,
          row,
          field: f,
          value: raw,
          reason: "Correction guidée depuis la fiche 360°",
        });
      }
    },
    onSuccess: () => {
      onBeforeSave();
      toast.success("Fiche corrigée — modification journalisée et annulable");
      void qc.invalidateQueries({ queryKey: ["fiche-client", clientId] });
      void qc.invalidateQueries({ queryKey: ["clients"] });
      void qc.invalidateQueries({ queryKey: ["fiche-score", clientId] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={primary ? "default" : "outline"}
          className="h-7 shrink-0 gap-1 px-2 text-xs"
        >
          <Wrench className="h-3 w-3" /> {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        {fields.map((f) => (
          <div key={f} className="space-y-1">
            <Label htmlFor={`fix-${f}`} className="text-xs">
              {FIELD_LABEL[f]}
            </Label>
            {f === "report_policy" || f === "lifecycle_status" ? (
              <div className="flex flex-wrap gap-1">
                {(f === "report_policy"
                  ? (["oui", "non", "a_confirmer"] as ReportPolicy[]).map((v) => ({
                      value: v as string,
                      label: REPORT_POLICY_META[v].short,
                    }))
                  : (["actif", "perdu"] as ClientLifecycle[]).map((v) => ({
                      value: v as string,
                      label: LIFECYCLE_META[v].label,
                    }))
                ).map((o) => (
                  <Button
                    key={o.value}
                    type="button"
                    size="sm"
                    variant={values[f] === o.value ? "secondary" : "ghost"}
                    className="h-7 px-2 text-xs"
                    onClick={() => setValues((s) => ({ ...s, [f]: o.value }))}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            ) : (
              <Input
                id={`fix-${f}`}
                value={values[f] ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, [f]: e.target.value }))}
                placeholder={FIELD_LABEL[f]}
              />
            )}
          </div>
        ))}
        <Button size="sm" className="w-full" disabled={mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Enregistrer
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Écriture journalisée (avant / après) et annulable. Un champ laissé vide ne remplace jamais
          une donnée existante.
        </p>
      </PopoverContent>
    </Popover>
  );
}
