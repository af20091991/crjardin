import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, Shield, Lock, Database, Users, Mail, Trash2 } from "lucide-react";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Confidentialité & Sécurité — CR Jardin" },
      {
        name: "description",
        content:
          "Comment CR Jardin protège vos données : accès, chiffrement, conservation, sous-traitants et contact.",
      },
      { property: "og:title", content: "Confidentialité & Sécurité — CR Jardin" },
      {
        property: "og:description",
        content:
          "Comment CR Jardin protège vos données : accès, chiffrement, conservation, sous-traitants et contact.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TrustPage,
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Shield;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground leading-relaxed">
        {children}
      </CardContent>
    </Card>
  );
}

function TrustPage() {
  return (
    <div className="min-h-screen bg-secondary/40 px-4 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link to="/" className="mb-4 flex flex-col items-center">
            <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Leaf className="h-7 w-7" />
            </div>
            <span className="font-serif text-2xl font-semibold">CR Jardin</span>
          </Link>
          <h1 className="font-serif text-3xl font-semibold">Confidentialité & Sécurité</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Cette page est maintenue par l'équipe CR Jardin pour répondre aux questions
            courantes sur la sécurité et la confidentialité de l'application. Il s'agit d'un
            contenu éditable de l'application et non d'une certification indépendante.
          </p>
        </div>

        <div className="space-y-4">
          <Section icon={Users} title="Accès et authentification">
            <p>
              L'accès à l'application nécessite la création d'un compte. Chaque nouvelle
              inscription est validée manuellement par un administrateur avant l'activation.
              Les utilisateurs de l'équipe peuvent consulter les fiches et interventions, mais
              ne peuvent modifier que leurs propres entrées. Les liens de partage destinés aux
              clients utilisent un jeton secret unique donnant accès uniquement à leur fiche.
            </p>
          </Section>

          <Section icon={Lock} title="Protection des données">
            <p>
              Les échanges avec l'application sont chiffrés en transit (HTTPS). L'accès aux
              données est restreint par des règles de sécurité au niveau de la base de données,
              de sorte que chaque utilisateur n'accède qu'aux informations qui le concernent
              selon son rôle.
            </p>
          </Section>

          <Section icon={Database} title="Données collectées et utilisation">
            <p>
              Nous collectons les informations nécessaires au suivi des chantiers : coordonnées
              des clients, comptes-rendus d'intervention, photos et annotations. Ces données
              sont utilisées exclusivement pour fournir le service de suivi et de reporting, et
              ne sont pas vendues à des tiers.
            </p>
          </Section>

          <Section icon={Shield} title="Hébergement et sous-traitants">
            <p>
              L'application s'appuie sur l'infrastructure cloud de Lovable pour l'hébergement,
              la base de données, l'authentification et le stockage de fichiers. Ces
              prestataires assurent l'exploitation technique de la plateforme.
            </p>
          </Section>

          <Section icon={Trash2} title="Conservation et suppression">
            <p>
              Les données sont conservées tant que votre compte est actif. Pour demander la
              modification ou la suppression de vos données, contactez l'administrateur de
              l'application.
            </p>
          </Section>

          <Section icon={Mail} title="Contact sécurité">
            <p>
              Pour toute question relative à la sécurité ou à la confidentialité, ou pour
              signaler une vulnérabilité, contactez l'administrateur à l'adresse{" "}
              <a
                className="text-primary underline underline-offset-4"
                href="mailto:fournier.anthony2009@gmail.com"
              >
                fournier.anthony2009@gmail.com
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}