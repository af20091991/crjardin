// prettier-ignore
import React from "react";
// prettier-ignore
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Link,
} from "@react-email/components";
// prettier-ignore
import type { TemplateEntry } from "./registry";

// prettier-ignore
interface Props {
  civility?: string;
  firstName?: string;
  lastName?: string;
  premiumUrl?: string;
  unsubscribeUrl?: string;
}

// prettier-ignore
const Email = ({ civility, firstName, lastName, premiumUrl, unsubscribeUrl }: Props) => {
  const recipient =
    [civility, firstName, lastName].filter((value) => value?.trim()).join(" ") ||
    "Madame, Monsieur";

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre jardin a désormais sa toute nouvelle interface en ligne : le Compte Premium</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>De la graine au jardin</Text>
          <Text style={paragraph}>Bonjour {recipient},</Text>
          <Text style={paragraph}>
            <strong>Votre jardin a désormais sa toute nouvelle interface en ligne : le Compte Premium.</strong>
          </Text>
          <Text style={paragraph}>
            Réservé exclusivement aux clients ayant souscrit un{" "}
            <strong>devis d’entretien annuel de leur jardin</strong>, cet espace fait partie des services associés à
            votre contrat avec De la graine au jardin.
          </Text>
          <Text style={paragraph}>
            Vous y retrouverez au même endroit les informations essentielles de votre jardin:{" "}
            <strong>
              interventions réalisées et à venir, photos, documents utiles et historique de son suivi
            </strong>
            .
          </Text>
          <Heading as="h2" style={subtitle}>
            Un nouveau canal privilégié entre nous
          </Heading>
          <Text style={paragraph}>
            Je vous encourage vivement à utiliser votre Compte Premium pour{" "}
            <strong>me transmettre vos questions, demandes, remarques ou besoins concernant votre jardin</strong>.
          </Text>
          <Text style={paragraph}>
            Les demandes envoyées depuis l’interface Premium seront{" "}
            <strong>identifiées directement et traitées en priorité</strong>. Cela me permettra d’être plus réactif et
            de conserver toutes les informations liées à votre jardin au même endroit.
          </Text>
          <Text style={paragraph}>
            Une question, une demande particulière, une intervention à prévoir ou simplement une remarque après mon
            passage: <strong>passez directement par votre Compte Premium.</strong>
          </Text>
          <Text style={paragraph}>
            <strong>Le Compte Premium est exclusivement réservé aux clients bénéficiant d’un entretien annuel</strong>{" "}
            et constitue un service supplémentaire inclus dans le suivi de leur jardin.
          </Text>
          <Section style={buttonSection}>
            <Button href={premiumUrl} style={button}>
              Accéder à mon Compte Premium
            </Button>
          </Section>
          <Text style={paragraph}>Votre lien d’accès personnel vous est communiqué ci-dessous.</Text>
          <Text style={paragraph}>
            Bienvenue dans votre <strong>Compte Premium</strong>, votre nouvel espace dédié au suivi de votre jardin.
          </Text>
          <Text style={paragraph}>À très bientôt,</Text>
          <Text style={unsubscribe}>
            Vous recevez cet e-mail dans le cadre du suivi de votre jardin avec De la graine au jardin.
            Si vous ne souhaitez plus recevoir ce type de message,{" "}
            {unsubscribeUrl ? (
              <Link href={unsubscribeUrl} style={unsubscribeLink}>
                vous pouvez vous désabonner ici
              </Link>
            ) : (
              " vous pouvez vous désabonner via le lien prévu à cet effet en bas de cet e-mail."
            )}
            .
          </Text>
          <Text style={signature}>
            Anthony Fournier
            <br />
            <strong>De la graine au jardin</strong>
            <br />
            Paysagiste conseil à Montpellier et ses alentours
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

// prettier-ignore
export const template = {
  component: Email,
  subject: () => "Votre Compte Premium est prêt — De la graine au jardin",
  displayName: "Mise à disposition du Compte Premium",
  previewData: {
    civility: "Madame",
    firstName: "Sophie",
    lastName: "Martin",
    premiumUrl: "https://crjardin.lovable.app/partage/exemple",
  },
} satisfies TemplateEntry;

// prettier-ignore
const garamond =
  "Garamond, 'EB Garamond', 'Cormorant Garamond', Georgia, 'Times New Roman', serif";
// prettier-ignore
const main = { backgroundColor: "#ffffff", fontFamily: garamond };
// prettier-ignore
const container = { padding: "28px 24px", maxWidth: "640px", margin: "0 auto" };
// prettier-ignore
const brand = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#4F8E33",
  margin: "0",
  fontFamily: garamond,
};
// prettier-ignore
const subtitle = {
  fontSize: "19px",
  lineHeight: "1.35",
  color: "#2f3a26",
  fontFamily: garamond,
  margin: "24px 0 12px",
};
// prettier-ignore
const paragraph = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#2f3a26",
  margin: "0 0 14px",
  fontFamily: garamond,
};
// prettier-ignore
// prettier-ignore
const buttonSection = { textAlign: "center" as const, margin: "26px 0" };
const button = {
  backgroundColor: "#4F8E33",
  borderRadius: "7px",
  color: "#ffffff",
  fontFamily: garamond,
  fontSize: "16px",
  fontWeight: 700,
  padding: "12px 22px",
  textDecoration: "none",
};
// prettier-ignore
const unsubscribeLink = {
  color: "#4F8E33",
  textDecoration: "underline",
};
// prettier-ignore
const unsubscribe = {
  fontSize: "12px",
  lineHeight: "1.5",
  color: "#6b7564",
  fontFamily: garamond,
  marginTop: "24px",
};

const signature = {
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#2f3a26",
  fontFamily: garamond,
  marginTop: "18px",
};
