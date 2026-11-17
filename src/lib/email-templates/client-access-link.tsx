// prettier-ignore
import React from "react";
// prettier-ignore
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
// prettier-ignore
import type { TemplateEntry } from "./registry";

// prettier-ignore
interface Props {
  civility?: string;
  firstName?: string;
  lastName?: string;
  premiumUrl?: string;
}

// prettier-ignore
const Email = ({ civility, firstName, lastName, premiumUrl }: Props) => {
  const recipient =
    [civility, firstName, lastName].filter((value) => value?.trim()).join(" ") || "Madame, Monsieur";
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre espace client De la graine au jardin</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>De la graine au jardin</Text>
          <Heading as="h2" style={subtitle}>Votre espace client</Heading>
          <Text style={paragraph}>Bonjour {recipient},</Text>
          <Text style={paragraph}>
            Retrouvez à tout moment les interventions, photos et documents de votre jardin grâce au lien
            privé ci-dessous. Aucun mot de passe n’est nécessaire.
          </Text>
          <Section style={buttonSection}>
            <Button href={premiumUrl} style={button}>Accéder à mon espace client</Button>
          </Section>
          <Text style={footer}>
            Ce lien est personnel : ne le transmettez à personne d’autre. Si vous pensez qu’il a été partagé,
            demandez-nous un nouveau lien.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

// prettier-ignore
export const template = {
  component: Email,
  subject: () => "Votre espace client — De la graine au jardin",
  displayName: "Lien d'accès à l'espace client",
  previewData: {
    civility: "Madame",
    firstName: "Sophie",
    lastName: "Martin",
    premiumUrl: "https://crjardin.lovable.app/partage/exemple",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#f6f7f2", fontFamily: "Inter, Arial, sans-serif" };
const container = {
  margin: "0 auto",
  padding: "24px",
  maxWidth: "560px",
  backgroundColor: "#ffffff",
};
const brand = { color: "#4F8E33", fontSize: "14px", fontWeight: 600, margin: "0 0 12px" };
const subtitle = { color: "#1f2a1c", fontSize: "20px", margin: "0 0 16px" };
const paragraph = { color: "#1f2a1c", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" };
const buttonSection = { textAlign: "center" as const, margin: "24px 0" };
const button = {
  backgroundColor: "#4F8E33",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "12px 20px",
  fontSize: "15px",
  textDecoration: "none",
};
const footer = { color: "#6b7280", fontSize: "12px", lineHeight: "18px" };
