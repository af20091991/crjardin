import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getSiteWebTechnicalAudit,
  type SiteWebTechnicalAudit,
} from "@/lib/site-web-technical.functions";
import { listAnalyticsProperties, runAnalyticsReport } from "@/lib/site-web-api";

type GeoObservation = {
  id: string;
  testedAt: string;
  platform: string;
  prompt: string;
  mentioned: boolean;
  citedUrl: string;
  notes: string;
};

type AnalyticsRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

const GEO_STORAGE_KEY = "site-web:geo-observations:v1";
const AI_SOURCE_PATTERN = /chatgpt|openai|perplexity|gemini|copilot|claude|you\.com|poe\.com|phind|mistral|meta\.ai/i;
const SITE_DOMAIN = "www.delagraineaujardin.com";

export function SiteWebTechnicalGeo() {
  const [audit, setAudit] = useState<SiteWebTechnicalAudit | null>(null);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [aiSessions, setAiSessions] = useState<number | null>(null);
  const [aiSources, setAiSources] = useState<Array<{ source: string; sessions: number }> | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [observations, setObservations] = useState<GeoObservation[]>([]);
  const [platform, setPlatform] = useState("ChatGPT");
  const [prompt, setPrompt] = useState("Quel paysagiste peut créer un jardin méditerranéen avec peu d’arrosage à Montpellier ?");
  const [mentioned, setMentioned] = useState(false);
  const [citedUrl, setCitedUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [observationError, setObservationError] = useState<string | null>(null);

  const loadAudit = async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const result = await getSiteWebTechnicalAudit();
      setAudit(result);
    } catch {
      setAuditError("L’audit technique n’a pas pu être chargé. Vérifiez la session et réessayez.");
    } finally {
      setAuditLoading(false);
    }
  };

  const loadAiReferrals = async () => {
    setAnalyticsError(null);
    setAiSessions(null);
    setAiSources(null);
    const propertiesResult = await listAnalyticsProperties();
    if (propertiesResult.error) {
      setAnalyticsError(propertiesResult.error);
      return;
    }
    const properties = propertiesResult.data?.properties ?? [];
    const selected =
      properties.find((item) => item.name === "properties/159443253") ??
      properties.find((item) => item.name === "159443253") ??
      properties[0];
    if (!selected) {
      setAnalyticsError("Aucune propriété Google Analytics 4 accessible.");
      return;
    }
    const result = await runAnalyticsReport({
      propertyId: selected.name.replace(/^properties\//, ""),
      startDate: daysAgo(30),
      endDate: yesterday(),
      dimensions: ["sessionSourceMedium"],
      metrics: ["sessions"],
    });
    if (result.error) {
      setAnalyticsError(result.error);
      return;
    }
    const report = result.data as { rows?: AnalyticsRow[] } | null;
    const matches = (report?.rows ?? [])
      .map((row) => ({
        source: row.dimensionValues?.[0]?.value ?? "Source inconnue",
        sessions: Number(row.metricValues?.[0]?.value ?? 0),
      }))
      .filter((row) => AI_SOURCE_PATTERN.test(row.source))
      .sort((a, b) => b.sessions - a.sessions);
    setAiSources(matches);
    setAiSessions(matches.reduce((sum, row) => sum + row.sessions, 0));
  };

  useEffect(() => {
    void loadAudit();
    void loadAiReferrals();
    try {
      const stored = window.localStorage.getItem(GEO_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as GeoObservation[];
        if (Array.isArray(parsed)) setObservations(parsed);
      }
    } catch {
      setObservationError("Le journal local n’a pas pu être lu sur ce navigateur.");
    }
  }, []);

  const addObservation = () => {
    if (!platform.trim() || !prompt.trim()) return;
    const item: GeoObservation = {
      id: `geo-${Date.now()}`,
      testedAt: new Date().toISOString(),
      platform: platform.trim(),
      prompt: prompt.trim(),
      mentioned,
      citedUrl: citedUrl.trim(),
      notes: notes.trim(),
    };
    const next = [item, ...observations].slice(0, 100);
    try {
      window.localStorage.setItem(GEO_STORAGE_KEY, JSON.stringify(next));
      setObservations(next);
      setPrompt("");
      setMentioned(false);
      setCitedUrl("");
      setNotes("");
      setObservationError(null);
    } catch {
      setObservationError("Impossible d’enregistrer cette observation dans le stockage local du navigateur.");
    }
  };

  const deleteObservation = (id: string) => {
    const next = observations.filter((item) => item.id !== id);
    try {
      window.localStorage.setItem(GEO_STORAGE_KEY, JSON.stringify(next));
      setObservations(next);
    } catch {
      setObservationError("Impossible de mettre à jour le journal local.");
    }
  };

  const field = audit?.pageSpeed;
  const fieldVitalsAvailable =
    field?.fieldLcpMs != null || field?.fieldInpMs != null || field?.fieldCls != null;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold">Technique, performance & GEO</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Contrôles observés du site, données de performance Google et suivi documenté de visibilité dans les IA.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Site audité : {SITE_DOMAIN}
                {audit?.checkedAt ? ` · Vérifié le ${formatDateTime(audit.checkedAt)}` : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { void loadAudit(); void loadAiReferrals(); }} disabled={auditLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${auditLoading ? "animate-spin" : ""}`} />
            Actualiser l’audit
          </Button>
        </div>
      </Card>

      {auditError && <ErrorNotice message={auditError} />}
      {audit?.pageSpeedError && (
        <Card className="border-border p-4">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            PageSpeed : {audit.pageSpeedError}. Les contrôles HTML/HTTP restent consultables.
          </p>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-semibold">Performance mobile</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Les scores Lighthouse sont des mesures de laboratoire ; les Core Web Vitals terrain ne sont affichés que si Google fournit des données réelles.
            </p>
          </div>
          <Badge variant="outline">PageSpeed Insights</Badge>
        </div>
        {auditLoading && !audit ? (
          <p className="py-6 text-sm text-muted-foreground">Audit en cours…</p>
        ) : field ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Score label="Performance" value={field.performance} />
              <Score label="SEO technique" value={field.seo} />
              <Score label="Accessibilité" value={field.accessibility} />
              <Score label="Bonnes pratiques" value={field.bestPractices} />
            </div>
            <div className="mt-5">
              <h4 className="text-sm font-medium">Core Web Vitals terrain</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {fieldVitalsAvailable
                  ? `Catégorie terrain : ${translateFieldCategory(field.fieldCategory)}`
                  : "Aucune donnée terrain disponible pour cette URL ; les résultats de laboratoire ci-dessous ne les remplacent pas."}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Vital label="LCP terrain" value={field.fieldLcpMs} unit="ms" good={2500} poor={4000} />
                <Vital label="INP terrain" value={field.fieldInpMs} unit="ms" good={200} poor={500} />
                <Vital label="CLS terrain" value={field.fieldCls} unit="" good={0.1} poor={0.25} decimals={3} />
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-border/70 p-4">
              <h4 className="text-sm font-medium">Mesures de laboratoire (mobile)</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <LabValue label="LCP" value={field.labLcpMs} unit="ms" />
                <LabValue label="INP" value={field.labInpMs} unit="ms" />
                <LabValue label="CLS" value={field.labCls} unit="" decimals={3} />
                <LabValue label="FCP" value={field.labFcpMs} unit="ms" />
                <LabValue label="TBT" value={field.labTbtMs} unit="ms" />
              </div>
            </div>
          </>
        ) : (
          <EmptyMessage message="Aucune mesure PageSpeed exploitable pour le moment." />
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-serif text-lg font-semibold">Contrôles techniques et SEO de base</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Vérifications publiques de la page d’accueil, de robots.txt et du sitemap. Ce contrôle ne remplace pas un scan de sécurité authentifié de WordPress.
        </p>
        {auditLoading && !audit ? (
          <p className="py-6 text-sm text-muted-foreground">Vérifications en cours…</p>
        ) : audit ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <CheckRow label="Réponse HTTP" value={audit.http ? `${audit.http.status} · ${audit.http.final_url}` : null} good={audit.http?.status === 200} />
            <CheckRow label="Redirection HTTP → HTTPS" value={audit.http?.https_redirect == null ? null : audit.http.https_redirect ? "Détectée" : "Non détectée"} good={audit.http?.https_redirect === true} />
            <CheckRow label="HSTS" value={audit.http ? audit.http.hsts ? "Présent" : "Absent" : null} good={audit.http?.hsts === true} />
            <CheckRow label="robots.txt" value={audit.files?.robots_txt == null ? null : audit.files.robots_txt ? "Accessible et reconnu" : "Non reconnu"} good={audit.files?.robots_txt === true} />
            <CheckRow label="Sitemap XML" value={audit.files?.sitemap_url ?? null} good={Boolean(audit.files?.sitemap_url)} />
            <CheckRow label="Balise title" value={audit.page?.title ?? null} good={Boolean(audit.page?.title)} />
            <CheckRow label="Meta description" value={audit.page?.meta_description ?? null} good={Boolean(audit.page?.meta_description)} />
            <CheckRow label="Balises H1" value={audit.page ? String(audit.page.h1_count) : null} good={audit.page?.h1_count === 1} />
            <CheckRow label="Images sans attribut alt" value={audit.page ? String(audit.page.images_without_alt) : null} good={audit.page?.images_without_alt === 0} />
            <CheckRow label="Données structurées JSON-LD" value={audit.page ? audit.page.json_ld_types.length ? audit.page.json_ld_types.join(", ") : "Aucun type détecté" : null} good={Boolean(audit.page?.json_ld_types.length)} />
            <CheckRow label="Liens internes détectés" value={audit.page ? String(audit.page.internal_links) : null} good={Boolean(audit.page && audit.page.internal_links > 0)} />
            <CheckRow label="Temps de réponse WordPress" value={null} good={null} />
          </div>
        ) : (
          <EmptyMessage message="Les contrôles techniques n’ont pas pu être récupérés." />
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Une valeur « indisponible » signifie que le contrôle n’a pas pu être établi ; elle n’est pas assimilée à un échec.
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-semibold">Trafic référé par les IA</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Sessions que GA4 attribue à des sources connues comme ChatGPT, Perplexity ou Gemini, sur les 30 derniers jours. Ce relevé est partiel : les visites sans référent identifiable n’y figurent pas.
            </p>
          </div>
          <Badge variant="outline">Google Analytics 4</Badge>
        </div>
        {analyticsError ? (
          <p className="mt-4 text-sm text-muted-foreground">Donnée indisponible : {analyticsError}</p>
        ) : aiSessions == null ? (
          <p className="mt-4 text-sm text-muted-foreground">Chargement des sources de trafic IA…</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-sm text-muted-foreground">Sessions attribuées aux IA</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(aiSessions)}</p>
              <p className="mt-1 text-xs text-muted-foreground">30 derniers jours · GA4</p>
            </div>
            <div className="space-y-2">
              {aiSources?.length ? aiSources.map((item) => (
                <div key={item.source} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm">
                  <span className="break-all">{item.source}</span>
                  <span className="shrink-0 font-medium tabular-nums">{formatNumber(item.sessions)}</span>
                </div>
              )) : (
                <p className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
                  Aucune session attribuée aux sources IA reconnues sur cette période. Cela ne prouve pas l’absence de citations par les IA.
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-semibold">Journal de tests de visibilité IA</h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Répétez les mêmes questions dans différentes IA, puis notez la mention de l’entreprise et l’URL éventuellement citée. Ce journal est enregistré uniquement dans le stockage local de ce navigateur ; il n’est pas synchronisé avec les autres appareils.
            </p>
          </div>
          <Badge variant="outline">{observations.length} observation{observations.length > 1 ? "s" : ""}</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input aria-label="Plateforme IA testée" value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="Plateforme (ChatGPT, Gemini…)" />
          <Input aria-label="URL citée par l’IA" value={citedUrl} onChange={(event) => setCitedUrl(event.target.value)} placeholder="URL citée (facultatif)" />
          <div className="md:col-span-2">
            <Textarea aria-label="Question testée" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Question exacte posée à l’IA" rows={2} />
          </div>
          <div className="md:col-span-2">
            <Textarea aria-label="Notes de test" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contexte, position de la mention, concurrents cités… (facultatif)" rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={mentioned} onChange={(event) => setMentioned(event.target.checked)} className="h-4 w-4 accent-primary" />
            L’entreprise a été mentionnée dans la réponse
          </label>
          <div className="md:col-span-2">
            <Button onClick={addObservation} disabled={!platform.trim() || !prompt.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Enregistrer le test
            </Button>
          </div>
        </div>
        {observationError && <p className="mt-3 text-sm text-destructive">{observationError}</p>}
        {observations.length > 0 && (
          <div className="mt-5 space-y-3">
            {observations.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{item.platform}</p>
                      <Badge variant={item.mentioned ? "default" : "outline"}>{item.mentioned ? "Mention trouvée" : "Pas de mention"}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(item.testedAt)}</span>
                    </div>
                    <p className="mt-2 text-sm">{item.prompt}</p>
                    {item.citedUrl && (
                      <a className="mt-2 inline-flex items-center gap-1 break-all text-sm text-primary underline" href={item.citedUrl} target="_blank" rel="noreferrer">
                        {item.citedUrl}<ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                    {item.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p>}
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Supprimer cette observation" onClick={() => deleteObservation(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value == null ? "—" : `${value}/100`}</p>
    </div>
  );
}

function Vital({
  label,
  value,
  unit,
  good,
  poor,
  decimals = 0,
}: {
  label: string;
  value: number | null;
  unit: string;
  good: number;
  poor: number;
  decimals?: number;
}) {
  const state = value == null ? "unavailable" : value <= good ? "good" : value <= poor ? "needs-work" : "poor";
  const statusLabel = state === "good" ? "Bon" : state === "needs-work" ? "À améliorer" : state === "poor" ? "Insuffisant" : "Indisponible";
  const formatted = value == null ? "—" : decimals ? value.toFixed(decimals).replace(".", ",") : formatNumber(Math.round(value));
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{formatted}{value == null || unit === "" ? "" : ` ${unit}`}</p>
      <p className="mt-1 text-xs text-muted-foreground">{statusLabel}</p>
    </div>
  );
}

function LabValue({ label, value, unit, decimals = 0 }: { label: string; value: number | null; unit: string; decimals?: number }) {
  const formatted = value == null ? "—" : decimals ? value.toFixed(decimals).replace(".", ",") : formatNumber(Math.round(value));
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium tabular-nums">{formatted}{value == null || unit === "" ? "" : ` ${unit}`}</p>
    </div>
  );
}

function CheckRow({ label, value, good }: { label: string; value: string | null; good: boolean | null }) {
  const icon = value == null ? <Info className="h-4 w-4 text-muted-foreground" /> : good ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg border border-border/60 p-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm">{value ?? "Indisponible"}</p>
      </div>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <Card className="border-destructive/30 p-4 text-sm text-destructive">{message}</Card>;
}

function EmptyMessage({ message }: { message: string }) {
  return <p className="py-5 text-sm text-muted-foreground">{message}</p>;
}

function translateFieldCategory(value: string | null) {
  if (value === "FAST") return "Bonne";
  if (value === "AVERAGE") return "À améliorer";
  if (value === "SLOW") return "Mauvaise";
  return value ?? "Non fournie";
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function yesterday() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
