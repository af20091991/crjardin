import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileText, MapPin, Search, Target } from "lucide-react";
import { siteWebDemoModel } from "@/lib/site-web-model";

type View = "visibility" | "local" | "content" | "actions";

function Pill({ children }: { children: ReactNode }) {
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {children}
    </Badge>
  );
}

export function SiteWebViewContent({ view }: { view: View }) {
  if (view === "visibility") {
    return (
      <div className="space-y-4">
        <Card className="p-5">
          <div className="grid gap-5 sm:grid-cols-4">
            <Metric
              label="Requêtes"
              value={String(siteWebDemoModel.requetes.length)}
            />
            <Metric label="Position moyenne" value={averagePosition()} />
            <Metric
              label="Impressions"
              value={formatNumber(
                siteWebDemoModel.requetes.reduce(
                  (n, q) => n + q.impressions,
                  0,
                ),
              )}
            />
            <Metric
              label="Clics"
              value={formatNumber(
                siteWebDemoModel.requetes.reduce((n, q) => n + q.clics, 0),
              )}
            />
          </div>
        </Card>

        <Card className="p-5">
          <Header
            icon={Search}
            title="Requêtes suivies"
            description="Jeu de démonstration centralisé — aucune source externe."
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Requête</th>
                  <th className="pb-2 text-right">Position</th>
                  <th className="pb-2 text-right">Impressions</th>
                  <th className="pb-2 text-right">Clics</th>
                </tr>
              </thead>
              <tbody>
                {siteWebDemoModel.requetes.map((q) => (
                  <tr key={q.id} className="border-t border-border/40">
                    <td className="py-3">{q.requete}</td>
                    <td className="py-3 text-right">
                      <Pill>#{q.position}</Pill>
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(q.impressions)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(q.clics)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  if (view === "local") {
    return (
      <div className="space-y-4">
        <Card className="p-5">
          <Header
            icon={MapPin}
            title="SEO local"
            description="État de la présence locale et positions de démonstration."
          />
          <div className="mt-4 divide-y divide-border/40">
            {siteWebDemoModel.seoLocal.fiche.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="text-sm">{item.critere}</span>
                <Pill>
                  {item.etat === "ok"
                    ? "Complet"
                    : item.etat === "partiel"
                      ? "Partiel"
                      : "Manquant"}
                </Pill>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {siteWebDemoModel.seoLocal.communes.map((commune) => (
            <Card key={commune.id} className="p-4">
              <p className="text-sm font-medium">{commune.nom}</p>
              <p className="mt-2 font-serif text-2xl font-semibold">
                #{commune.position}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Position de démonstration
              </p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (view === "content") {
    return (
      <Card className="p-5">
        <Header
          icon={FileText}
          title="Contenus"
          description="Inventaire des pages piloté par le modèle Site web."
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2">Page</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">État</th>
                <th className="pb-2 text-right">SEO</th>
              </tr>
            </thead>
            <tbody>
              {siteWebDemoModel.pages.map((page) => (
                <tr key={page.id} className="border-t border-border/40">
                  <td className="py-3 font-medium">{page.titre}</td>
                  <td className="py-3 text-muted-foreground">{page.type}</td>
                  <td className="py-3">
                    <Pill>
                      {page.statut === "publie"
                        ? "Publié"
                        : page.statut === "a_enrichir"
                          ? "À enrichir"
                          : "Brouillon"}
                    </Pill>
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {page.scoreSeo ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <Header
        icon={Target}
        title="Actions"
        description="Actions issues du modèle de démonstration. La persistance sera traitée ultérieurement."
      />
      <div className="mt-4 divide-y divide-border/40">
        {siteWebDemoModel.actions.map((action) => (
          <div
            key={action.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div>
              <p className="text-sm font-medium">{action.titre}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {action.theme}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Pill>Impact {action.impact}</Pill>
              <Pill>Priorité {action.priorite}</Pill>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Header({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Search;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-muted/50 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function averagePosition() {
  const values = siteWebDemoModel.requetes.map((q) => q.position);
  return (values.reduce((a, b) => a + b, 0) / values.length)
    .toFixed(1)
    .replace(".", ",");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
