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
  title?: string;
  body?: string | null;
  unsubscribeUrl?: string;
}

const Email = ({
  civility,
  firstName,
  lastName,
  premiumUrl,
  title,
  body,
  unsubscribeUrl,
}: Props) => {
  const recipient =
    [civility, firstName, lastName].filter((value) => value?.trim()).join(" ") ||
    "Madame, Monsieur";

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{title ?? "Une nouveauté dans votre Compte Premium"}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>De la graine au jardin</Text>
          <Text style={paragraph}>Bonjour {recipient},</Text>
          <Text style={paragraph}>
            <strong>{title}</strong>
          </Text>
          {body ? <Text style={paragraph}>{body}</Text> : null}
          <Section style={buttonSection}>
            <Button href={premiumUrl} style={button}>
              Consulter mon espace
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

const main = { backgroundColor: "#F9F7F2", fontFamily: "Inter, Arial, sans-serif" };
const container = { margin: "0 auto", padding: "32px 24px", maxWidth: "560px" };
const brand = {
  color: "#4F8E33",
  fontSize: "13px",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};
const paragraph = { color: "#333", fontSize: "16px", lineHeight: "26px" };
const buttonSection = { textAlign: "center" as const, margin: "28px 0" };
const button = {
  backgroundColor: "#4F8E33",
  color: "#FFFFFF",
  padding: "12px 22px",
  borderRadius: "8px",
  textDecoration: "none",
  fontSize: "15px",
};
const signature = { color: "#333", fontSize: "15px", lineHeight: "22px" };
const unsubscribe = { color: "#8a8a8a", fontSize: "12px", marginTop: "32px" };
const unsubscribeLink = { color: "#8a8a8a", textDecoration: "underline" };

export const template: TemplateEntry = {
  component: Email,
  subject: (data) => `${data.title ?? "Nouveauté"} — De la graine au jardin`,
  displayName: "Notification Premium validée par le gérant",
  previewData: {
    civility: "Madame",
    firstName: "Sophie",
    lastName: "Martin",
    premiumUrl: "https://pp.delagraineaujardin.com/partage/exemple",
    title: "Nouveau compte-rendu : Taille des haies",
    body: "Le compte-rendu de la dernière intervention est disponible.",
  },
};
