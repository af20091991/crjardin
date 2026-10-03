import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  civility?: string;
  firstName?: string;
  lastName?: string;
  premiumUrl?: string;
  unsubscribeUrl?: string;
}

const Email = ({ civility, firstName, lastName, premiumUrl, unsubscribeUrl }: Props) => {
  const recipient =
    [civility, firstName, lastName].filter((value) => value?.trim()).join(" ") ||
    "Madame, Monsieur";

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Je vous ai écrit dans votre Compte Premium</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>De la graine au jardin</Text>
          <Text style={paragraph}>Bonjour {recipient},</Text>
          <Text style={paragraph}>
            <strong>Je vous ai écrit</strong> dans votre Compte Premium.
          </Text>
          <Section style={buttonSection}>
            <Button href={premiumUrl} style={button}>
              Lire mon message
            </Button>
          </Section>
          <Text style={paragraph}>À très bientôt,</Text>
          <Text style={signature}>
            Anthony Fournier
            <br />
            <strong>De la graine au jardin</strong>
          </Text>
          <Text style={unsubscribe}>
            Vous recevez cet e-mail dans le cadre du suivi de votre jardin.{" "}
            {unsubscribeUrl ? (
              <Link href={unsubscribeUrl} style={unsubscribeLink}>
                Se désabonner
              </Link>
            ) : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: () => "Un message pour vous — De la graine au jardin",
  displayName: "Nouveau message dans le Compte Premium",
  previewData: {
    civility: "Madame",
    firstName: "Sophie",
    lastName: "Martin",
    premiumUrl: "https://crjardin.lovable.app/partage/exemple",
  },
} satisfies TemplateEntry;

const garamond = "Garamond, 'EB Garamond', 'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const main = { backgroundColor: "#ffffff", fontFamily: garamond };
const container = { padding: "28px 24px", maxWidth: "640px", margin: "0 auto" };
const brand = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#4F8E33",
  margin: "0",
  fontFamily: garamond,
};
const paragraph = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#2f3a26",
  margin: "0 0 14px",
  fontFamily: garamond,
};
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
const signature = {
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#2f3a26",
  fontFamily: garamond,
  marginTop: "18px",
};
const unsubscribe = {
  fontSize: "12px",
  lineHeight: "1.5",
  color: "#6b7564",
  fontFamily: garamond,
  marginTop: "24px",
};
const unsubscribeLink = { color: "#4F8E33", textDecoration: "underline" };
