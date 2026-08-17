// Centre de contrôle des données (Pilot Pro V2.3+ — Phase 7 bis).
// Regroupement ergonomique : diagnostic (Qualité), décision humaine (Validation
// manuelle + Rapprochement CA) et action guidée (Corrections assistées).
// Aucune règle métier, aucun calcul ni aucune donnée n'est modifié ici : la page
// ne fait que réunir les écrans existants sous une entrée unique.
import { createFileRoute, Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { BadgeCheck, ClipboardList, ListChecks, Copy, Cpu, Database, FileText, Gauge, Link2, MapPin, ShieldAlert, ShieldCheck, Wrench } from "lucide-react";
import { QualityPage } from "@/components/pilot/panels/QualityPanel";
import { ValidationPage } from "@/components/pilot/panels/ValidationPanel";
import { RapprochementPage } from "@/components/pilot/panels/RapprochementPanel";
import { CorrectionsPage } from "@/components/pilot/panels/CorrectionsPanel";
import { SourcesPanel } from "@/components/pilot/panels/SourcesPanel";
import { ReferentialPanel } from "@/components/pilot/panels/ReferentialPanel";
import { AttachmentCertificationPanel } from "@/components/pilot/panels/AttachmentCertificationPanel";
import { EnginePanel } from "@/components/pilot/panels/EnginePanel";
import { DoublonsPanel } from "@/components/pilot/panels/DoublonsPanel";
import { KpiContractPanel } from "@/components/pilot/panels/KpiContractPanel";
import { KpiReliabilityPanel } from "@/components/pilot/panels/KpiReliabilityPanel";
import { IntegrityPanel } from "@/components/pilot/panels/IntegrityPanel";
import { ActionQueuePanel } from "@/components/pilot/panels/ActionQueuePanel";

type Section =
  | "actions"
  | "qualite"
  | "validation"
  | "corrections"
  | "sources"
  | "referentiel"
  | "moteur"
  | "doublons"
  | "contrat"
  | "fiabilite"
  | "integrite";

export const Route = createFileRoute("/_authenticated/pilot/controle")({
  validateSearch: (search: Record<string, unknown>): { section?: Section; sub?: string } => ({
    section: (
      [
        "actions",
        "qualite",
        "validation",
        "corrections",
        "sources",
        "referentiel",
        "moteur",
        "doublons",
        "contrat",
        "fiabilite",
        "integrite",
      ] as const
    ).includes(search.section as never)
      ? (search.section as Section)
      : undefined,
    sub: typeof search.sub === "string" ? search.sub : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Centre de contrôle des données — Pilot Pro" },
      {
        name: "description",
        content:
          "Point d'entrée unique de la fiabilité Pilot Pro : diagnostic qualité, validations manuelles et corrections assistées.",
      },
      { property: "og:title", content: "Centre de contrôle des données — Pilot Pro" },
      {
        property: "og:description",
        content: "Diagnostic, décisions humaines et corrections guidées des données Pilot Pro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ControlCenterPage,
});

function ControlCenterPage() {
  const { section = "actions", sub } = Route.useSearch();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Gauge className="h-6 w-6 text-primary" />
          Centre de contrôle des données
        </h1>
        <p className="text-sm text-muted-foreground">
          Diagnostic, décisions humaines et corrections guidées. Aucun rapprochement automatique,
          aucune migration : chaque action reste validée et historisée.
        </p>
      </header>

      <Tabs value={section}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="actions" asChild>
            <Link to="/pilot/controle" search={{ section: "actions" }} className="gap-1.5">
              <ListChecks className="h-4 w-4" /> À traiter
            </Link>
          </TabsTrigger>
          <TabsTrigger value="referentiel" asChild>
            <Link to="/pilot/controle" search={{ section: "referentiel" }} className="gap-1.5">
              <BadgeCheck className="h-4 w-4" /> Référentiel client
            </Link>
          </TabsTrigger>
          <TabsTrigger value="doublons" asChild>
            <Link to="/pilot/controle" search={{ section: "doublons" }} className="gap-1.5">
              <Copy className="h-4 w-4" /> Doublons clients
            </Link>
          </TabsTrigger>
          <TabsTrigger value="qualite" asChild>
            <Link to="/pilot/controle" search={{ section: "qualite" }} className="gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Qualité des données
            </Link>
          </TabsTrigger>
          <TabsTrigger value="validation" asChild>
            <Link to="/pilot/controle" search={{ section: "validation" }} className="gap-1.5">
              <Link2 className="h-4 w-4" /> Validation manuelle
            </Link>
          </TabsTrigger>
          <TabsTrigger value="corrections" asChild>
            <Link to="/pilot/controle" search={{ section: "corrections" }} className="gap-1.5">
              <Wrench className="h-4 w-4" /> Corrections assistées
            </Link>
          </TabsTrigger>
          <TabsTrigger value="sources" asChild>
            <Link to="/pilot/controle" search={{ section: "sources" }} className="gap-1.5">
              <Database className="h-4 w-4" /> Sources & états
            </Link>
          </TabsTrigger>
          <TabsTrigger value="contrat" asChild>
            <Link to="/pilot/controle" search={{ section: "contrat" }} className="gap-1.5">
              <FileText className="h-4 w-4" /> Contrat des KPI
            </Link>
          </TabsTrigger>
          <TabsTrigger value="fiabilite" asChild>
            <Link to="/pilot/controle" search={{ section: "fiabilite" }} className="gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Fiabilité des KPI
            </Link>
          </TabsTrigger>
          <TabsTrigger value="integrite" asChild>
            <Link to="/pilot/controle" search={{ section: "integrite" }} className="gap-1.5">
              <ShieldAlert className="h-4 w-4" /> Intégrité des données
            </Link>
          </TabsTrigger>
          <TabsTrigger value="moteur" asChild>
            <Link to="/pilot/controle" search={{ section: "moteur" }} className="gap-1.5">
              <Cpu className="h-4 w-4" /> Moteur analytique
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            File d'actions — ce qui peut être corrigé automatiquement, ce qui est proposé et attend
            votre confirmation, et ce qui exige une décision humaine (avec la raison).
          </p>
          <ActionQueuePanel />
        </TabsContent>

        <TabsContent value="referentiel" className="mt-4 space-y-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Certification — quelles fiches sont de véritables clients économiques (préalable
            obligatoire à tout indicateur stratégique).
          </p>
          <ReferentialPanel />
          <AttachmentCertificationPanel />
        </TabsContent>

        <TabsContent value="doublons" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Nettoyage sécurisé — détection des fiches probablement identiques, comparaison des
            historiques et fusion manuelle réversible.
          </p>
          <DoublonsPanel />
        </TabsContent>

        <TabsContent value="qualite" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Vue de diagnostic — mesure l'état de santé des données (lecture seule).
          </p>
          <QualityPage />
        </TabsContent>

        <TabsContent value="validation" className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Décision humaine — situations où Pilot Pro demande un arbitrage : lignes financières
            incertaines et lignes de CA non identifiées.
          </p>
          <Tabs value={sub === "rapprochement" ? "rapprochement" : "analytique"}>
            <TabsList className="flex h-auto flex-wrap justify-start">
              <TabsTrigger value="analytique" asChild>
                <Link to="/pilot/controle" search={{ section: "validation", sub: "analytique" }}>
                  Validation analytique
                </Link>
              </TabsTrigger>
              <TabsTrigger value="rapprochement" asChild>
                <Link to="/pilot/controle" search={{ section: "validation", sub: "rapprochement" }}>
                  Rapprochement CA
                </Link>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="analytique" className="mt-4">
              <ValidationPage />
            </TabsContent>
            <TabsContent value="rapprochement" className="mt-4">
              <RapprochementPage />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="integrite" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Contrôle avant affichage — existence des colonnes, complétude des périodes, bornes « à
            date », doublons, rattachements et cohérence arithmétique (lecture seule).
          </p>
          <IntegrityPanel />
        </TabsContent>

        <TabsContent value="corrections" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Action guidée — traitement des anomalies connues, une ligne à la fois.
          </p>
          <CorrectionsPage />
        </TabsContent>

        <TabsContent value="sources" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Référence — quelle donnée fait foi, où en est le rapprochement, et effet réel des
            validations manuelles (lecture seule).
          </p>
          <SourcesPanel />
        </TabsContent>

        <TabsContent value="contrat" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Contrat de vérité — pour chaque indicateur stratégique : sa fonction source, sa source de
            données, sa période, son périmètre et sa règle en cas de donnée absente (lecture seule).
          </p>
          <KpiContractPanel />
        </TabsContent>

        <TabsContent value="fiabilite" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Fiabilité — pour chaque indicateur du contrat : peut-il être utilisé avec confiance,
            et sinon pourquoi (lecture seule, aucun recalcul).
          </p>
          <KpiReliabilityPanel />
        </TabsContent>

        <TabsContent value="moteur" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Traçabilité — chaîne de calcul unique, mode strict et audit automatique de cohérence
            entre le moteur et les autres chemins de calcul (lecture seule).
          </p>
          <EnginePanel />
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm">
          <span className="text-muted-foreground">Outils conservés séparément :</span>
          <Link to="/pilot/donnees" className="flex items-center gap-1.5 font-medium text-primary underline">
            <ClipboardList className="h-4 w-4" /> Classeur de données
          </Link>
          <Link to="/pilot/sites" className="flex items-center gap-1.5 font-medium text-primary underline">
            <MapPin className="h-4 w-4" /> Sites & contacts
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
