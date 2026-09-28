import type { ReactNode } from "react";
import type { CompetitorCheck } from "@/lib/site-web-competitors.functions";

type Rating = "good" | "average" | "poor" | "neutral";

const RATING_STYLE: Record<Rating, string> = {
  good: "bg-emerald-500",
  average: "bg-amber-500",
  poor: "bg-red-500",
  neutral: "bg-muted-foreground/40",
};

const RATING_LABEL: Record<Rating, string> = {
  good: "Bon",
  average: "À améliorer",
  poor: "Faible",
  neutral: "Info",
};

const nf = new Intl.NumberFormat("fr-FR");

function rate(value: number | null, good: number, poor: number, lowerIsBetter = true): Rating {
  if (value == null) return "neutral";
  if (lowerIsBetter) return value <= good ? "good" : value > poor ? "poor" : "average";
  return value >= good ? "good" : value < poor ? "poor" : "average";
}

function seconds(ms: number | null) {
  return ms == null ? "—" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

function daysAgo(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 60) return `il y a ${days} jours`;
  return `il y a ${Math.round(days / 30)} mois`;
}

function Row({
  label,
  value,
  rating = "neutral",
  hint,
}: {
  label: string;
  value: ReactNode;
  rating?: Rating;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${RATING_STYLE[rating]}`}
        title={RATING_LABEL[rating]}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-sm">{label}</span>
          <span className="text-sm font-medium">{value}</span>
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}

function IssueList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

const FIELD_CATEGORY: Record<string, { label: string; rating: Rating }> = {
  FAST: { label: "Rapide", rating: "good" },
  AVERAGE: { label: "Moyenne", rating: "average" },
  SLOW: { label: "Lente", rating: "poor" },
};

export function SiteWebCompetitorDetails({ check }: { check: CompetitorCheck }) {
  const details = check.details;
  if (!details) {
    return (
      <p className="text-xs text-muted-foreground">
        Cette analyse est antérieure au détail : relance-la (bouton actualiser) pour l'obtenir.
      </p>
    );
  }
  const { pagespeed, page, http, files, content } = details;
  const metrics = pagespeed?.metrics;
  const field = pagespeed?.field;
  const fieldCategory = field?.category ? FIELD_CATEGORY[field.category] : undefined;
  const titleLength = page?.title?.length ?? 0;
  const descriptionLength = page?.meta_description?.length ?? 0;
  const monthlyRhythm =
    content?.posts_last_90_days != null
      ? Math.round((content.posts_last_90_days / 3) * 10) / 10
      : null;
  const allIssues =
    (pagespeed?.seo_issues.length ?? 0) +
    (pagespeed?.accessibility_issues.length ?? 0) +
    (pagespeed?.best_practices_issues.length ?? 0) +
    (pagespeed?.opportunities.length ?? 0);

  return (
    <div className="mt-3 space-y-5 border-t border-border/60 pt-3">
      <p className="text-xs text-muted-foreground">
        Pastille : <span className="text-emerald-600">verte = bon</span>,{" "}
        <span className="text-amber-600">orange = à améliorer</span>,{" "}
        <span className="text-red-600">rouge = faible</span>. Scores sur 100 : 90 et plus = bon, 50
        à 89 = à améliorer, moins de 50 = faible. Mesures effectuées sur mobile.
      </p>

      {metrics && (
        <Section title="Vitesse du site (mobile)">
          <Row
            label="Affichage du contenu principal"
            value={seconds(metrics.lcp_ms)}
            rating={rate(metrics.lcp_ms, 2500, 4000)}
            hint="Temps avant que l'élément principal (image, titre) soit visible. Objectif : moins de 2,5 s."
          />
          <Row
            label="Premier affichage"
            value={seconds(metrics.fcp_ms)}
            rating={rate(metrics.fcp_ms, 1800, 3000)}
            hint="Temps avant que quoi que ce soit s'affiche à l'écran. Objectif : moins de 1,8 s."
          />
          <Row
            label="Réactivité au chargement"
            value={metrics.tbt_ms == null ? "—" : `${nf.format(metrics.tbt_ms)} ms`}
            rating={rate(metrics.tbt_ms, 200, 600)}
            hint="Durée pendant laquelle la page est figée par le chargement des scripts. Objectif : moins de 200 ms."
          />
          <Row
            label="Stabilité visuelle"
            value={metrics.cls == null ? "—" : String(metrics.cls).replace(".", ",")}
            rating={rate(metrics.cls, 0.1, 0.25)}
            hint="Les éléments bougent-ils pendant le chargement ? Objectif : moins de 0,1."
          />
          <Row
            label="Vitesse d'affichage perçue"
            value={seconds(metrics.speed_index_ms)}
            rating={rate(metrics.speed_index_ms, 3400, 5800)}
            hint="Rapidité avec laquelle la page se remplit visuellement. Objectif : moins de 3,4 s."
          />
          <Row
            label="Temps de réponse du serveur"
            value={
              metrics.server_response_ms == null
                ? "—"
                : `${nf.format(metrics.server_response_ms)} ms`
            }
            rating={rate(metrics.server_response_ms, 600, 1800)}
            hint="Délai avant que le serveur commence à répondre (hébergement, cache)."
          />
          <Row
            label="Poids de la page"
            value={
              metrics.page_weight_kb == null
                ? "—"
                : `${(metrics.page_weight_kb / 1024).toFixed(1).replace(".", ",")} Mo`
            }
            rating={rate(metrics.page_weight_kb, 2048, 5120)}
            hint="Volume total à télécharger. Une page légère (moins de 2 Mo) est plus rapide sur mobile."
          />
        </Section>
      )}

      {pagespeed && (
        <Section title="Expérience réelle des visiteurs (Google, 28 derniers jours)">
          {field ? (
            <>
              <Row
                label="Verdict global"
                value={fieldCategory?.label ?? "—"}
                rating={fieldCategory?.rating ?? "neutral"}
                hint="Mesuré sur de vrais visiteurs Chrome, pas en laboratoire."
              />
              <Row
                label="Affichage du contenu principal"
                value={seconds(field.lcp_ms)}
                rating={rate(field.lcp_ms, 2500, 4000)}
              />
              <Row
                label="Stabilité visuelle"
                value={field.cls == null ? "—" : String(field.cls).replace(".", ",")}
                rating={rate(field.cls, 0.1, 0.25)}
              />
              <Row
                label="Réactivité aux clics"
                value={field.inp_ms == null ? "—" : `${nf.format(field.inp_ms)} ms`}
                rating={rate(field.inp_ms, 200, 500)}
                hint="Délai entre un clic et la réponse de la page. Objectif : moins de 200 ms."
              />
            </>
          ) : (
            <p className="py-1.5 text-xs text-muted-foreground">
              Pas assez de visiteurs Chrome pour que Google publie des données réelles : le site a
              probablement un trafic modeste.
            </p>
          )}
        </Section>
      )}

      {page && (
        <Section title="Référencement de la page d'accueil">
          <Row
            label="Titre"
            value={page.title ?? "Absent"}
            rating={
              !page.title ? "poor" : titleLength >= 30 && titleLength <= 65 ? "good" : "average"
            }
            hint={
              page.title
                ? `${titleLength} caractères (idéal : 30 à 65, sinon Google le tronque).`
                : "Sans titre, la page est très mal référencée."
            }
          />
          <Row
            label="Description"
            value={page.meta_description ?? "Absente"}
            rating={
              !page.meta_description
                ? "poor"
                : descriptionLength >= 70 && descriptionLength <= 160
                  ? "good"
                  : "average"
            }
            hint={
              page.meta_description
                ? `${descriptionLength} caractères (idéal : 70 à 160). C'est le texte affiché sous le lien dans Google.`
                : "Google affichera un extrait au hasard sous le lien."
            }
          />
          <Row
            label="Titres principaux (H1)"
            value={page.h1_count}
            rating={page.h1_count === 1 ? "good" : page.h1_count === 0 ? "poor" : "average"}
            hint={`Un seul H1 par page est recommandé. Sous-titres (H2) : ${page.h2_count}.`}
          />
          <Row
            label="Indexation autorisée"
            value={page.noindex ? "Non (noindex)" : "Oui"}
            rating={page.noindex ? "poor" : "good"}
          />
          <Row
            label="Adresse canonique"
            value={page.canonical ? "Définie" : "Absente"}
            rating={page.canonical ? "good" : "average"}
            hint="Évite que Google confonde plusieurs adresses pour la même page."
          />
          <Row
            label="Partage réseaux sociaux (Open Graph)"
            value={page.open_graph ? "Oui" : "Non"}
            rating={page.open_graph ? "good" : "average"}
            hint="Titre et image affichés quand on partage le lien sur Facebook, LinkedIn…"
          />
          <Row
            label="Données structurées"
            value={page.json_ld_types.length > 0 ? page.json_ld_types.join(", ") : "Aucune"}
            rating={page.json_ld_types.length > 0 ? "good" : "average"}
            hint="Informations lisibles par Google (entreprise, avis, produits…) pour des résultats enrichis."
          />
          <Row
            label="Images sans texte alternatif"
            value={`${page.images_without_alt} sur ${page.images_total}`}
            rating={
              page.images_total === 0
                ? "neutral"
                : page.images_without_alt === 0
                  ? "good"
                  : page.images_without_alt / page.images_total > 0.3
                    ? "poor"
                    : "average"
            }
            hint="Le texte alternatif aide l'accessibilité et le référencement des images."
          />
          <Row
            label="Contenu de la page"
            value={`${nf.format(page.word_count)} mots`}
            rating={rate(page.word_count, 300, 100, false)}
            hint={`${page.internal_links} liens internes, ${page.external_links} liens vers d'autres sites.`}
          />
          <Row
            label="Langue déclarée"
            value={page.lang ?? "Non précisée"}
            rating={page.lang ? "good" : "average"}
          />
        </Section>
      )}

      {(http || files) && (
        <Section title="Technique">
          {http && (
            <>
              <Row
                label="Redirection http → https"
                value={
                  http.https_redirect == null ? "Non testée" : http.https_redirect ? "Oui" : "Non"
                }
                rating={
                  http.https_redirect == null ? "neutral" : http.https_redirect ? "good" : "average"
                }
                hint="Les visiteurs arrivant en http sont-ils envoyés vers la version sécurisée ?"
              />
              <Row
                label="Sécurité renforcée (HSTS)"
                value={http.hsts ? "Activée" : "Non"}
                rating={http.hsts ? "good" : "neutral"}
              />
              <Row
                label="Serveur"
                value={http.server ?? "Non communiqué"}
                hint={`Page d'accueil : ${nf.format(http.html_size_kb)} Ko de code, statut HTTP ${http.status}.`}
              />
            </>
          )}
          {files && (
            <>
              <Row
                label="Fichier robots.txt"
                value={
                  files.robots_txt == null ? "Non testé" : files.robots_txt ? "Présent" : "Absent"
                }
                rating={files.robots_txt ? "good" : "average"}
                hint="Indique aux moteurs de recherche ce qu'ils peuvent explorer."
              />
              <Row
                label="Plan du site (sitemap)"
                value={
                  files.sitemap_url
                    ? files.sitemap_urls != null
                      ? `${nf.format(files.sitemap_urls)} adresses`
                      : "Présent"
                    : "Introuvable"
                }
                rating={files.sitemap_url ? "good" : "average"}
                hint="Le nombre d'adresses donne une idée de la taille du site."
              />
            </>
          )}
        </Section>
      )}

      {(content || page?.generator) && (
        <Section title="Contenu et activité éditoriale">
          <Row
            label="Outil de création du site"
            value={content?.is_wordpress ? "WordPress" : (page?.generator ?? "Non identifié")}
            hint={
              content?.is_wordpress && page?.generator && !/wordpress/i.test(page.generator)
                ? `Déclaré : ${page.generator}`
                : undefined
            }
          />
          {content?.posts_total != null && (
            <>
              <Row
                label="Articles publiés"
                value={nf.format(content.posts_total)}
                hint="Nombre total d'articles de blog visibles publiquement."
              />
              <Row
                label="Dernier article"
                value={
                  content.last_post_date
                    ? `${new Date(content.last_post_date).toLocaleDateString("fr-FR")} (${daysAgo(content.last_post_date)})`
                    : "—"
                }
                rating={
                  content.last_post_date
                    ? (Date.now() - new Date(content.last_post_date).getTime()) / 86_400_000 <= 45
                      ? "good"
                      : (Date.now() - new Date(content.last_post_date).getTime()) / 86_400_000 <=
                          180
                        ? "average"
                        : "poor"
                    : "neutral"
                }
                hint="Un blog actif montre un concurrent qui travaille son référencement."
              />
              {monthlyRhythm != null && (
                <Row
                  label="Rythme de publication"
                  value={`${String(monthlyRhythm).replace(".", ",")} article(s) / mois`}
                  hint={`${content.posts_last_90_days} article(s) sur les 90 derniers jours.`}
                />
              )}
            </>
          )}
        </Section>
      )}

      {allIssues > 0 && pagespeed && (
        <div className="space-y-3 rounded-lg bg-muted/40 p-3">
          <p className="text-sm font-medium">Points faibles détectés chez ce concurrent</p>
          {pagespeed.opportunities.length > 0 && (
            <div>
              <p className="text-xs font-medium">Gains de vitesse possibles</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {pagespeed.opportunities.map((item) => (
                  <li key={item.title}>
                    {item.title} (environ {seconds(item.savings_ms)} gagnées)
                  </li>
                ))}
              </ul>
            </div>
          )}
          <IssueList title="Référencement" items={pagespeed.seo_issues} />
          <IssueList title="Accessibilité" items={pagespeed.accessibility_issues} />
          <IssueList title="Bonnes pratiques" items={pagespeed.best_practices_issues} />
        </div>
      )}
    </div>
  );
}
