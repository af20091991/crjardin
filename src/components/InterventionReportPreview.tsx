import { useEffect, useState } from "react";
import type { Intervention, InterventionTask, InterventionPhoto } from "@/lib/interventions";
import { TASK_STATUS_META, type TaskStatus, signedPhotoUrl } from "@/lib/interventions";
import type { Client } from "@/lib/clients";
import { gardenLabel } from "@/lib/clients";
import type { GardenHealth, Recommendation } from "@/lib/garden";
import type { WorksiteSheet } from "@/lib/worksite";
import {
  HEALTH_RATING_META, type HealthRating,
  RECO_STATUS_META, type RecommendationStatus,
  recommendationPrice, formatEuro,
} from "@/lib/garden";
import logo from "@/assets/logo.png";

export interface ReportPreviewProps {
  intervention: Intervention;
  client: Client;
  tasks: InterventionTask[];
  photos: InterventionPhoto[];
  health: GardenHealth[];
  recommendations: Recommendation[];
  worksite?: WorksiteSheet | null;
  companyName?: string;
  authorName?: string;
  signatureData?: string | null;
  stampData?: string | null;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-md bg-primary/5 px-3 py-2 text-primary">
      <h3 className="text-base font-semibold">{children}</h3>
    </div>
  );
}

function PhotoTile({ path, caption }: { path: string; caption: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    signedPhotoUrl(path).then((u) => { if (alive) setUrl(u); }).catch(() => {});
    return () => { alive = false; };
  }, [path]);
  return (
    <div className="space-y-1">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-muted">
        {url ? <img src={url} alt={caption ?? ""} className="h-full w-full object-cover" /> : null}
      </div>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

/**
 * Aperçu HTML du compte-rendu client. Reproduit fidèlement les blocs et l'ordre
 * du PDF généré par `intervention-pdf.ts` afin de garantir une source unique
 * de vérité côté mise en page.
 */
export function InterventionReportPreview({
  intervention: iv, client, tasks, photos, health, recommendations, worksite,
  companyName, authorName, signatureData, stampData,
}: ReportPreviewProps) {
  const company = companyName?.trim() || "De la graine au jardin";
  const author = authorName?.trim() || company;
  const garden = gardenLabel(client);
  const dateStr = new Date(iv.intervention_date).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const clientFull = [client.civility?.trim(), client.name?.trim()].filter(Boolean).join(" ") || garden;
  const reportPhotos = photos.filter((p) => p.include_in_report);

  return (
    <div className="mx-auto max-w-[210mm] rounded-lg border border-border bg-white text-[13px] text-foreground shadow-sm print:shadow-none">
      {/* Cover */}
      <div className="relative bg-primary px-8 py-8 text-primary-foreground">
        <div className="absolute right-6 top-6 flex h-16 w-16 items-center justify-center rounded-md bg-white p-2">
          <img src={logo} alt="" className="h-full w-full object-contain" />
        </div>
        <h2 className="font-serif text-2xl font-bold">Compte-rendu d'intervention</h2>
        <p className="mt-1 text-sm opacity-90">{company}</p>
      </div>

      <div className="px-8 pb-8 pt-6">
        <h3 className="font-serif text-lg font-bold">{clientFull}</h3>
        <div className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
          {iv.title?.trim() && <p>Objet : {iv.title.trim()}</p>}
          {iv.reference && <p>Référence : {iv.reference}</p>}
          <p>Client : {garden}</p>
          {client.address && <p>Adresse : {client.address}</p>}
          <p>Date : {dateStr}</p>
          <p>Type d'intervention : {iv.intervention_type ?? "Entretien"}</p>
          {client.contract_type && <p>Contrat : {client.contract_type}{client.frequency ? ` (${client.frequency})` : ""}</p>}
        </div>

        <Heading>Synthèse de l'intervention</Heading>
        <p className="mt-2 whitespace-pre-wrap text-[13px]">{iv.summary?.trim() || <span className="text-muted-foreground">—</span>}</p>

        {worksite && (
          <>
            <Heading>Fiche jardin</Heading>
            <div className="mt-2 space-y-1 text-[12.5px]">
              {worksite.client_name && <p><span className="font-medium">Jardin :</span> {worksite.client_name}</p>}
              {worksite.address && <p><span className="font-medium">Adresse :</span> {worksite.address}</p>}
              {worksite.access_complement && <p><span className="font-medium">Accès :</span> {worksite.access_complement}</p>}
              {worksite.tasks && worksite.tasks.length > 0 && (
                <p><span className="font-medium">Travaux prévus sur la fiche :</span> {worksite.tasks.join(", ")}</p>
              )}
              {worksite.garden_markers && worksite.garden_markers.length > 0 && (
                <p><span className="font-medium">Repères jardin :</span> {worksite.garden_markers.length} point(s) identifié(s)</p>
              )}
              {worksite.notes?.trim() && (
                <p className="whitespace-pre-wrap"><span className="font-medium">Observations sur la fiche :</span> {worksite.notes.trim()}</p>
              )}
            </div>
          </>
        )}

        <Heading>Travaux réalisés</Heading>
        {tasks.length === 0 ? (
          <p className="mt-2 text-muted-foreground">—</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {tasks.map((t) => {
              const st = (t.status as TaskStatus) in TASK_STATUS_META ? (t.status as TaskStatus) : "realise";
              return (
                <li key={t.id}>
                  <div className="font-medium">• {t.label} — {TASK_STATUS_META[st].label}</div>
                  {t.note?.trim() && <div className="ml-3 text-[12px] text-muted-foreground">{t.note}</div>}
                </li>
              );
            })}
          </ul>
        )}

        {(iv.garden_state?.trim() || health.length > 0) && (
          <>
            <Heading>État du jardin</Heading>
            {iv.garden_state?.trim() && <p className="mt-2 whitespace-pre-wrap">{iv.garden_state}</p>}
            {health.length > 0 && (
              <ul className="mt-2 space-y-1">
                {health.map((h) => {
                  const r = (h.rating as HealthRating) in HEALTH_RATING_META ? (h.rating as HealthRating) : "bon";
                  return (
                    <li key={h.id}>• {h.zone} : {HEALTH_RATING_META[r].label}{h.note ? ` — ${h.note}` : ""}</li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {(iv.recommendations_text?.trim() || recommendations.length > 0) && (
          <>
            <Heading>Préconisations & conseils</Heading>
            {iv.recommendations_text?.trim() && <p className="mt-2 whitespace-pre-wrap">{iv.recommendations_text}</p>}
            {recommendations.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {recommendations.map((r) => {
                  const st = (r.status as RecommendationStatus) in RECO_STATUS_META ? (r.status as RecommendationStatus) : "en_attente";
                  const price = recommendationPrice(r);
                  return (
                    <li key={r.id}>
                      <div className="font-medium">
                        • {r.title}{r.category ? ` [${r.category}]` : ""} — {RECO_STATUS_META[st].label}
                        {price != null && ` · ${formatEuro(price)}`}
                      </div>
                      {r.description?.trim() && <div className="ml-3 text-[12px] text-muted-foreground">{r.description}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {iv.upcoming_works?.trim() && (
          <>
            <Heading>Travaux prévus — prochaine intervention</Heading>
            <p className="mt-2 whitespace-pre-wrap">{iv.upcoming_works}</p>
          </>
        )}

        {reportPhotos.length > 0 && (
          <>
            <Heading>Photos de l'intervention</Heading>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {reportPhotos.map((p) => (
                <PhotoTile key={p.id} path={p.storage_path} caption={p.caption} />
              ))}
            </div>
          </>
        )}

        {/* Signature */}
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-primary">Signature — l'intervenant</p>
            <p className="text-[11px] text-muted-foreground">{author}</p>
            <div className="mt-2 h-20 border-b border-muted-foreground/40">
              {signatureData && <img src={signatureData} alt="" className="h-full object-contain" />}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary">Cachet — l'entreprise</p>
            <p className="text-[11px] text-muted-foreground">{company}</p>
            <div className="mt-2 h-24">
              {stampData && <img src={stampData} alt="" className="h-full object-contain" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}