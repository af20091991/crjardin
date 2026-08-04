// Centre de contrôle du référentiel client économique (Chantier critique 0).
// Rapport d'audit + décisions humaines. Aucune migration automatique : chaque
// changement de statut exige une justification et est journalisé.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, BadgeCheck, History, ShieldQuestion, Users } from "lucide-react";
import { toast } from "sonner";
import { formatEuro } from "@/lib/pilot";
import {
  ENTITY_STATUS_META,
  applyEntityDecision,
  listReferentialLog,
  runReferentialAudit,
  type EntityStatus,
  type ReferentialRow,
} from "@/lib/pilot-referential";

type Filter = "all" | "contacts" | "duplicates" | "probable" | "certified" | "review";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Toutes les fiches" },
  { id: "contacts", label: "Contacts probables" },
  { id: "duplicates", label: "Doublons possibles" },
  { id: "probable", label: "Clients probables" },
  { id: "review", label: "À examiner" },
  { id: "certified", label: "Certifiés" },
];

export function ReferentialPanel() {
  const qc = useQueryClient();
  const audit = useQuery({ queryKey: ["referential-audit"], queryFn: runReferentialAudit });
  const log = useQuery({ queryKey: ["referential-log"], queryFn: () => listReferentialLog(50) });
  const [filter, setFilter] = useState<Filter>("contacts");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<ReferentialRow | null>(null);
  const [status, setStatus] = useState<EntityStatus>("certified_client");
  const [reason, setReason] = useState("");
  const [entityName, setEntityName] = useState("");

  const decide = useMutation({
    mutationFn: () =>
      applyEntityDecision({
        row: target!,
        status,
        reason,
        suggestedEntityName: entityName.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Décision enregistrée et journalisée.");
      setTarget(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["referential-audit"] });
      qc.invalidateQueries({ queryKey: ["referential-log"] });
      // Une décision de référentiel change l'exploitabilité des entités :
      // tous les agrégats (CA, heures, rentabilité, classement, scores,
      // opportunités) doivent être reconstruits, les anciens résultats
      // n'étant plus valides.
      qc.invalidateQueries({ queryKey: ["entity-statuses"] });
      qc.invalidateQueries({ queryKey: ["client-economic-scores"] });
      qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("pilot-") });
      qc.invalidateQueries({ queryKey: ["confirmed-hours-by-client"] });
      qc.invalidateQueries({ queryKey: ["client-opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const all = audit.data?.rows ?? [];
    const q = search.trim().toLowerCase();
    return all
      .filter((r) => {
        if (filter === "contacts") return r.proposedStatus === "probable_contact";
        if (filter === "duplicates") return r.proposedStatus === "duplicate_candidate";
        if (filter === "probable") return r.proposedStatus === "probable_client" && r.status !== "certified_client";
        if (filter === "review") return r.status !== "certified_client" && r.proposedStatus === "manual_review_required";
        if (filter === "certified") return r.status === "certified_client";
        return true;
      })
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.dominantDesignation ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.caTotal - a.caTotal)
      .slice(0, 200);
  }, [audit.data, filter, search]);

  const t = audit.data?.totals;
  const att = audit.data?.caAttachment;

  function openDecision(row: ReferentialRow) {
    setTarget(row);
    setStatus(row.proposedStatus === "manual_review_required" ? "certified_client" : row.proposedStatus);
    setEntityName(row.suggestedEntityName ?? "");
    setReason("");
  }

  return (
    <div className="space-y-5">
      <Card className="border-orange-200 bg-orange-50/50">
        <CardContent className="flex gap-3 py-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
          <p className="text-muted-foreground">
            Une fiche « client » n'est pas automatiquement un client économique. Tant qu'une fiche
            n'est pas <strong>certifiée</strong>, ses indicateurs stratégiques sont affichés comme non
            fiables. Aucune fusion, aucun transfert de CA et aucune suppression d'historique n'est
            effectué ici : seul le statut de référence change, avec justification et journal.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Fiches analysées" value={t?.analysed ?? "—"} />
        <StatCard
          icon={<BadgeCheck className="h-4 w-4 text-emerald-600" />}
          label="Clients certifiés"
          value={t ? `${t.certified} / ${t.analysed}` : "—"}
          hint={t ? `${formatEuro(t.caCertified)} de CA certifié` : undefined}
        />
        <StatCard
          icon={<ShieldQuestion className="h-4 w-4 text-orange-600" />}
          label="Contacts mal classés"
          value={t?.probableContacts ?? "—"}
          hint="Fiches personne physique portant du CA d'une autre entité"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          label="Doublons détectés"
          value={t?.duplicates ?? "—"}
          hint={t ? `${formatEuro(t.caAtRisk)} et ${Math.round(t.hoursAtRisk)} h à identité incertaine` : undefined}
        />
      </div>

      {att && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contrôle du rattachement du CA</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <Line label="CA correctement rattaché (certifié)" value={`${att.ok} lignes`} />
            <Line label="CA porté par un contact probable" value={`${att.onContact} lignes`} />
            <Line label="CA sur doublon possible" value={`${att.onDuplicate} lignes`} />
            <Line label="CA à valider (client probable)" value={`${att.toValidate} lignes`} />
            <Line
              label="CA sans client"
              value={`${att.unattached} lignes — ${formatEuro(att.unattachedAmount)}`}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rapport d'audit — corrections proposées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={filter === f.id ? "default" : "outline"}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une fiche ou une désignation…"
              className="h-9 w-full sm:w-72"
            />
          </div>

          {audit.isLoading && <p className="text-sm text-muted-foreground">Audit du référentiel en cours…</p>}
          {audit.error && (
            <p className="text-sm text-destructive">Audit impossible : {(audit.error as Error).message}</p>
          )}

          {audit.data && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fiche</TableHead>
                    <TableHead>Statut actuel</TableHead>
                    <TableHead>Proposition</TableHead>
                    <TableHead>Entité économique lue dans le CA</TableHead>
                    <TableHead className="text-right">CA</TableHead>
                    <TableHead className="text-right">Heures réelles / hist. / vendues</TableHead>
                    <TableHead>Signaux</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.client_id}>
                      <TableCell className="align-top">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[r.civility, r.email, r.phone].filter(Boolean).join(" · ") || "Aucune coordonnée"}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className={ENTITY_STATUS_META[r.status].badge}>
                          {ENTITY_STATUS_META[r.status].short}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className={ENTITY_STATUS_META[r.proposedStatus].badge}>
                          {ENTITY_STATUS_META[r.proposedStatus].short}
                        </Badge>
                        <div className="mt-1 text-xs text-muted-foreground">confiance {r.confidence} %</div>
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {r.dominantDesignation ? (
                          <>
                            {r.dominantDesignation}
                            <div className="text-xs text-muted-foreground">
                              {Math.round(r.dominantShare * 100)} % du CA facturé
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-right text-sm">
                        {formatEuro(r.caTotal)}
                        <div className="text-xs text-muted-foreground">{r.caLines} ligne(s)</div>
                      </TableCell>
                      <TableCell className="align-top text-right text-sm">
                        {Math.round(r.hoursReal)} / {Math.round(r.hoursHistoric)} / {Math.round(r.hoursSold)} h
                      </TableCell>
                      <TableCell className="align-top">
                        <ul className="space-y-0.5 text-xs text-muted-foreground">
                          {r.signals.slice(0, 3).map((s) => (
                            <li key={s.code}>• {s.label}</li>
                          ))}
                          {r.attachmentWarnings.slice(0, 2).map((w) => (
                            <li key={w} className="text-orange-700">⚠ {w}</li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell className="align-top">
                        <Button size="sm" variant="outline" onClick={() => openDecision(r)}>
                          Décider
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                        Aucune fiche dans ce filtre.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" /> Journal des décisions de référentiel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {log.data && log.data.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {log.data.map((e) => (
                <li key={e.id} className="rounded-md border border-border p-2">
                  <div className="font-medium">
                    {e.client_name} — {e.action.replace("statut_referentiel:", "")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("fr-FR")} · CA concerné{" "}
                    {formatEuro(Number(e.ca_impacted) || 0)} · {Math.round(Number(e.hours_impacted) || 0)} h
                  </div>
                  {e.reason && <div className="mt-1 text-xs italic">« {e.reason} »</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune décision enregistrée : le référentiel n'a pas encore été certifié.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(target)} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Statut de référence — {target?.name}</DialogTitle>
            <DialogDescription>
              La décision est enregistrée avec sa justification. L'historique CA, les heures et les
              interventions ne sont pas modifiés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Statut</label>
              <Select value={status} onValueChange={(v) => setStatus(v as EntityStatus)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENTITY_STATUS_META) as EntityStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {ENTITY_STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{ENTITY_STATUS_META[status].hint}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Entité économique retenue (si la fiche est un contact)
              </label>
              <Input
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="Ex. Les Adagios"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Justification (obligatoire)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex. Facturation adressée à la résidence, Mme Bodard est la référente sur site."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Annuler
            </Button>
            <Button disabled={!reason.trim() || decide.isPending} onClick={() => decide.mutate()}>
              Enregistrer la décision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard(props: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {props.icon} {props.label}
        </div>
        <div className="font-display text-2xl font-semibold">{props.value}</div>
        {props.hint && <div className="text-xs text-muted-foreground">{props.hint}</div>}
      </CardContent>
    </Card>
  );
}

function Line(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="text-sm font-medium">{props.value}</div>
    </div>
  );
}
