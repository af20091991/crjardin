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

interface Row {
  label: string;
  score: number;
  impressions: number;
  clicks: number;
}
interface PageRow {
  label: string;
  status: string;
}
interface Props {
  monthLabel?: string;
  top?: Row[];
  pages?: PageRow[];
  radarUrl?: string;
}

const Email = ({ monthLabel = "", top = [], pages = [], radarUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{`Radar Visibilité locale — ${monthLabel}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>De la graine au jardin</Text>
        <Text style={tagline}>Radar Visibilité locale — {monthLabel}</Text>
        <Hr style={hr} />
        <Text style={paragraph}>
          <strong>Les opportunités les mieux classées ce mois-ci :</strong>
        </Text>
        {top.map((row, index) => (
          <Section key={index} style={card}>
            <Text style={cardTitle}>{row.label}</Text>
            <Text style={cardLine}>
              Score {row.score}/100 · {row.impressions} impressions · {row.clicks} clics (90 jours)
            </Text>
          </Section>
        ))}
        {pages.length > 0 ? (
          <>
            <Text style={paragraph}>
              <strong>Pages préparées :</strong>
            </Text>
            {pages.map((page, index) => (
              <Text key={index} style={cardLine}>
                {page.label} — {page.status}
              </Text>
            ))}
          </>
        ) : null}
        {radarUrl ? (
          <Section style={{ textAlign: "center" as const, margin: "18px 0 0" }}>
            <Button href={radarUrl} style={button}>
              Ouvrir le Radar
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
  subject: (data: Record<string, any>) => `Radar Visibilité locale — ${data?.monthLabel ?? ""}`,
  displayName: "Radar Visibilité locale (rapport mensuel)",
  previewData: {
    monthLabel: "octobre 2026",
    top: [{ label: "Création de jardin · Jacou", score: 78, impressions: 420, clicks: 12 }],
    pages: [{ label: "Visite conseil · Castries", status: "mesure disponible le 21/11/2026" }],
    radarUrl: "https://crjardin.lovable.app/pilot/site-web",
  },
} satisfies TemplateEntry;

const garamond = "Garamond, 'EB Garamond', 'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const main = { backgroundColor: "#ffffff", fontFamily: garamond };
const container = { padding: "24px", maxWidth: "600px", margin: "0 auto" };
const brand = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#4F8E33",
  margin: "0",
  textAlign: "center" as const,
  fontFamily: garamond,
};
const tagline = {
  fontSize: "14px",
  color: "#6b7564",
  margin: "2px 0 0",
  textAlign: "center" as const,
  fontFamily: garamond,
};
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
const cardLine = { fontSize: "14px", color: "#2f3a26", margin: "2px 0", fontFamily: garamond };
const button = {
  backgroundColor: "#4F8E33",
  color: "#ffffff",
  padding: "10px 20px",
  borderRadius: "6px",
  fontSize: "15px",
  fontFamily: garamond,
  textDecoration: "none",
};
