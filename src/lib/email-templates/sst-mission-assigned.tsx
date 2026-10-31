import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  subcontractorName?: string;
  serviceRequested?: string;
  dateLabel?: string;
  instructions?: string | null;
  missionUrl?: string;
}

const Email = ({
  subcontractorName,
  serviceRequested,
  dateLabel,
  instructions,
  missionUrl,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{`Nouvelle mission : ${serviceRequested ?? ""}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>De la graine au jardin</Text>
          <Text style={tagline}>Mission attribuée</Text>
        </Section>
        <Hr style={hr} />
        <Text style={paragraph}>
          Bonjour {subcontractorName ?? ""}, une mission vous a été attribuée :
        </Text>
        <Section style={card}>
          <Text style={cardTitle}>{serviceRequested}</Text>
          <Text style={cardWhen}>{dateLabel}</Text>
          {instructions ? <Text style={cardLine}>{instructions}</Text> : null}
        </Section>
        {missionUrl ? (
          <Section style={buttonSection}>
            <Button href={missionUrl} style={button}>
              Voir ma mission
            </Button>
          </Section>
        ) : null}
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches TemplateEntry's signature
  subject: (data: Record<string, any>) =>
    `Nouvelle mission attribuée${data?.dateLabel ? ` — ${data.dateLabel}` : ""}`,
  displayName: "Mission SST attribuée",
  previewData: {
    subcontractorName: "Fanny",
    serviceRequested: "Taille des haies",
    dateLabel: "lundi 2 novembre",
    instructions: "Prévoir le broyage des déchets verts.",
    missionUrl: "https://crjardin.lovable.app/sst",
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
const tagline = { fontSize: "14px", color: "#6b7564", margin: "2px 0 0", fontFamily: garamond };
const hr = { borderColor: "#e3e8dc", margin: "16px 0" };
const paragraph = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#2f3a26",
  margin: "0 0 14px",
  fontFamily: garamond,
};
const card = {
  borderLeft: "4px solid #4F8E33",
  backgroundColor: "#f4f8ef",
  padding: "10px 14px",
  margin: "0 0 12px",
};
const cardTitle = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#2f3a26",
  margin: "0",
  fontFamily: garamond,
};
const cardWhen = { fontSize: "12px", color: "#6b7564", margin: "2px 0 6px", fontFamily: garamond };
const cardLine = {
  fontSize: "14px",
  lineHeight: "1.5",
  color: "#2f3a26",
  margin: "0",
  fontFamily: garamond,
};
const buttonSection = { textAlign: "center" as const, margin: "22px 0 6px" };
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
