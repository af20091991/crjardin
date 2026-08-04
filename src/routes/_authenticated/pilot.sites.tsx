import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Check, History, MapPin, RefreshCw, Undo2, UserRound, X } from "lucide-react";
import {
  applySiteProposal, confidenceVerdict, createContactFromClient, listProposals, listSiteAudit,
  mergeDuplicateClients, proposalDetails, refreshProposals, revertSiteValidation,
  type MergeProposal, type ProposalDetails,
} from "@/lib/site-merge";
import { listContacts, listSites, updateContact } from "@/lib/sites";
import { formatEuro } from "@/lib/pilot";

export const Route = createFileRoute("/_authenticated/pilot/sites")({
  component: SitesMigrationPage,
});

const STATUS_TONE: Record<string, string> = {
  en_attente: "border-orange-200 bg-orange-50 text-orange-700",
  validee: "border-emerald-200 bg-emerald-50 text-emerald-700",
  modifiee: "border-emerald-200 bg-emerald-50 text-emerald-700",
  refusee: "border-border bg-muted text-muted-foreground",
};

function SitesMigrationPage() {
  const qc = useQueryClient();
  const proposals = useQuery({ queryKey: ["site-proposals"], queryFn: listProposals });
  const sites = useQuery({ queryKey: ["sites"], queryFn: listSites });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: listContacts });

  const refresh = useMutation({
    mutationFn: refreshProposals,
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["site-proposals"] });
      toast.success(n === 0 ? "Aucune nouvelle correspondance détectée" : `${n} correspondance(s) proposée(s)`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const pending = (proposals.data ?? []).filter((p) => p.status === "en_attente");
  const decided = (proposals.data ?? []).filter((p) => p.status !== "en_attente");
  const toReview = (contacts.data ?? []).filter((c) => c.needs_review);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg font-semibold">Sites d'intervention & contacts</h3>
          <p className="text-sm text-muted-foreground">
            Séparation Client (qui commande) / Site (où le travail est réalisé) / Contact (qui reçoit les comptes-rendus).
            Valider une proposition crée uniquement un <strong>site</strong> et ses <strong>alias</strong> : aucun client
            ni contact n'est modifié automatiquement, et aucune fiche historique n'est supprimée.
          </p>
        </div>
        <Button onClick={() => refresh.mutate()} disabled={refresh.isPending} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`} />
          Analyser les correspondances
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Sites officiels créés" value={String(sites.data?.length ?? 0)} icon={<MapPin className="h-4 w-4 text-primary" />} />
        <StatCard label="Correspondances à valider" value={String(pending.length)} icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} />
        <StatCard label="Contacts CR à corriger" value={String(toReview.length)} icon={<UserRound className="h-4 w-4 text-rose-500" />} />
      </div>

      {pending.length === 0 && (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            Aucune correspondance en attente. Lancez l'analyse pour détecter les fiches issues de l'import
            (ex. « Baudlet », « Baudlet 2h », « Baudlet Rg »).
          </CardContent>
        </Card>
      )}

      {pending.map((p) => (
        <ProposalCard key={p.id} proposal={p} />
      ))}

      {toReview.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h4 className="mb-2 flex items-center gap-2 font-medium">
              <UserRound className="h-4 w-4 text-rose-500" /> Contacts à corriger avant envoi de compte-rendu
            </h4>
            <ul className="space-y-2">
              {toReview.map((c) => (
                <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">
                    {c.civility ? `${c.civility} ` : ""}
                    {c.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.review_reason}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 px-2 text-xs"
                    onClick={async () => {
                      await updateContact(c.id, { needs_review: false, review_reason: null });
                      qc.invalidateQueries({ queryKey: ["contacts"] });
                      toast.success("Contact marqué comme vérifié");
                    }}
                  >
                    Marquer comme vérifié
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {decided.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h4 className="mb-2 font-medium">Décisions enregistrées</h4>
            <ul className="space-y-1.5 text-sm">
              {decided.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {p.suggested_site_name}
                    <span className="text-xs text-muted-foreground"> · {p.legacy_labels.length} libellé(s)</span>
                  </span>
                  <Badge variant="outline" className={STATUS_TONE[p.status]}>
                    {p.status === "refusee" ? "Refusée" : p.status === "modifiee" ? "Validée (modifiée)" : "Validée"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <AuditPanel />
    </div>
  );
}

function AuditPanel() {
  const qc = useQueryClient();
  const audit = useQuery({ queryKey: ["site-audit"], queryFn: () => listSiteAudit(20) });
  const entries = audit.data ?? [];
  const last = entries.find((e) => !e.reverted_at && e.site_id);

  const revert = useMutation({
    mutationFn: () => revertSiteValidation(last!),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["site-audit"] });
      qc.invalidateQueries({ queryKey: ["site-proposals"] });
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success(`Validation annulée · ${r.untagged} rattachement(s) retiré(s) — la trace est conservée`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 font-medium">
            <History className="h-4 w-4 text-primary" /> Journal des validations
          </h4>
          {last && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={revert.isPending}>
                  <Undo2 className="h-4 w-4" /> Annuler la dernière validation
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Annuler « {last.site_name} » ?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-foreground">Cette annulation va :</p>
                      <ul className="list-disc pl-5">
                        <li>retirer le rattachement au site sur les données concernées ;</li>
                        <li>supprimer le site créé et ses {last.alias_labels.length} alias ;</li>
                        <li>remettre la proposition en attente de décision.</li>
                      </ul>
                      <p className="font-medium text-foreground">Ne modifiera pas :</p>
                      <ul className="list-disc pl-5">
                        <li>les clients et les contacts ;</li>
                        <li>les calculs, indicateurs et analyses de rentabilité ;</li>
                        <li>la trace de l'action, qui reste conservée dans le journal.</li>
                      </ul>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => revert.mutate()}>Confirmer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <ul className="space-y-1.5 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2">
              <span className="min-w-0">
                <span className="font-medium">{e.site_name ?? "—"}</span>
                <span className="text-xs text-muted-foreground">
                  {" · "}
                  {new Date(e.created_at).toLocaleString("fr-FR")} · {e.alias_labels.length} alias ·{" "}
                  {Object.values(e.tagged_counts ?? {}).reduce((s, n) => s + Number(n ?? 0), 0)} rattachement(s)
                </span>
              </span>
              <Badge variant="outline" className={e.reverted_at ? STATUS_TONE.refusee : STATUS_TONE.validee}>
                {e.reverted_at ? "Annulée" : "Validée"}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon} {label}
        </div>
        <p className="font-serif text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ProposalCard({ proposal }: { proposal: MergeProposal }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [siteName, setSiteName] = useState(proposal.suggested_site_name);
  const [createdSiteId, setCreatedSiteId] = useState<string | null>(proposal.target_site_id);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["site-proposals"] });
    qc.invalidateQueries({ queryKey: ["sites"] });
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const validate = useMutation({
    mutationFn: (override?: { siteName: string }) => applySiteProposal(proposal, override),
    onSuccess: (r: { site_id: string; tagged: number; pendingClients: number }) => {
      setCreatedSiteId(r.site_id);
      invalidate();
      toast.success(
        r.pendingClients > 0
          ? `Site créé · ${r.tagged} enregistrement(s) rattaché(s) · ${r.pendingClients} fiche(s) en attente de votre confirmation`
          : `Site créé · ${r.tagged} enregistrement(s) rattaché(s)`,
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const dedupe = useMutation({
    mutationFn: () =>
      mergeDuplicateClients({
        targetClientId: proposal.target_client_id!,
        duplicateClientIds: proposal.legacy_client_ids,
        siteId: createdSiteId,
        siteName: siteName,
      }),
    onSuccess: (r) => {
      invalidate();
      toast.success(`${r.moved} enregistrement(s) rattaché(s) au client conservé`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const makeContact = useMutation({
    mutationFn: () => createContactFromClient(proposal.target_client_id!, createdSiteId),
    onSuccess: () => {
      invalidate();
      toast.success("Contact destinataire créé — vérifiez-le avant tout envoi de CR");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const refuse = useMutation({
    mutationFn: async () => {
      const { rejectProposal } = await import("@/lib/site-merge");
      return rejectProposal(proposal.id);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Proposition refusée — aucune donnée modifiée");
    },
  });

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Correspondances détectées</p>
            <p className="font-medium">{proposal.legacy_labels.join(" · ")}</p>
          </div>
          <Badge variant="outline" className={STATUS_TONE.en_attente}>À valider</Badge>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p>
            Client conservé : <strong>{proposal.suggested_client_name}</strong>
          </p>
          {editing ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} className="h-8 max-w-xs" />
              <Button size="sm" className="h-8" disabled={validate.isPending} onClick={() => validate.mutate({ siteName })}>
                Valider avec ce nom
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            </div>
          ) : (
            <p className="mt-1">
              Site créé : <strong>{proposal.suggested_site_name}</strong>
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Les autres libellés deviennent des alias de recherche du site et restent consultables. Un alias ne crée jamais
            de client et n'entraîne jamais la fusion de deux clients.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Impact label="Interventions" value={String(proposal.impact_interventions)} />
          <Impact label="Lignes de CA" value={`${proposal.impact_ca_entries} · ${formatEuro(proposal.impact_ca_amount)}`} />
          <Impact label="Heures" value={`${proposal.impact_hours.toFixed(1)} h`} />
          <Impact label="Missions SST" value={String(proposal.impact_missions)} />
        </div>

        {!editing && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" disabled={validate.isPending} onClick={() => validate.mutate(undefined)}>
              <Check className="h-4 w-4" /> Créer le site + alias
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={refuse.isPending} onClick={() => refuse.mutate()}>
              <X className="h-4 w-4" /> Refuser
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Modifier
            </Button>
          </div>
        )}

        {createdSiteId && (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">
              Étapes facultatives, à confirmer une par une. À n'utiliser que si ces libellés désignent bien le
              <strong> même client</strong> (jamais deux clients différents partageant un lieu ou un nom).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={dedupe.isPending || proposal.legacy_client_ids.length < 2}
                onClick={() => {
                  if (window.confirm("Confirmez-vous que ces libellés sont des doublons du MÊME client ? Les fiches sont conservées et marquées comme requalifiées.")) {
                    dedupe.mutate();
                  }
                }}
              >
                Ce sont des doublons du même client
              </Button>
              <Button size="sm" variant="ghost" disabled={makeContact.isPending} onClick={() => makeContact.mutate()}>
                Créer le contact destinataire des CR
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Impact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}