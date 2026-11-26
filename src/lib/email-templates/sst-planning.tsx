import React from "react";
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  authorLabel?: string;
  dateLabel?: string;
  statusLabel?: string;
  comment?: string;
}

const Email = ({ authorLabel, dateLabel, statusLabel, comment }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{`Planning SST — ${dateLabel ?? "journée mise à jour"}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>De la graine au jardin</Text>
          <Text style={tagline}>au rythme de la nature</Text>
        </Section>
        <Hr style={hr} />
        <Text style={paragraph}>
          <strong>{authorLabel ?? "Un utilisateur"}</strong> a mis à jour le calendrier des
          disponibilités pour le <strong>{dateLabel}</strong>.
        </Text>
        <Text style={paragraph}>Statut : {statusLabel ?? "Disponible"}</Text>
        {comment ? <Text style={quote}>{comment}</Text> : null}
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches TemplateEntry's signature
  subject: (data: Record<string, any>) =>
    `Planning SST — ${data?.dateLabel ?? "journée mise à jour"}`,
  displayName: "Planning SST (disponibilité mise à jour)",
  previewData: {
    authorLabel: "Équipe De la graine au jardin",
    dateLabel: "Lundi 5 octobre 2026",
    statusLabel: "Disponible",
    comment: "Taille de haies, prévoir la remorque.",
  },
} satisfies TemplateEntry;

const garamond = "Garamond, 'EB Garamond', 'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const main = { backgroundColor: "#ffffff", fontFamily: garamond };
const container = { padding: "24px", maxWidth: "600px", margin: "0 auto" };
const header = { textAlign: "center" as const, marginBottom: "4px" };
const brand = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#4F8E33",
  margin: "0",
  fontFamily: garamond,
};
const tagline = {
  fontSize: "14px",
  color: "#EE8627",
  margin: "2px 0 0",
  fontStyle: "italic" as const,
  fontFamily: garamond,
};
const paragraph = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#2f3a26",
  margin: "0 0 12px",
  fontFamily: garamond,
};
const quote = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#2f3a26",
  margin: "0 0 16px",
  padding: "8px 16px",
  borderLeft: "3px solid #4F8E33",
  backgroundColor: "#f6f8f3",
  fontFamily: garamond,
};
const hr = { borderColor: "#e6e6e6", margin: "16px 0 20px" };
