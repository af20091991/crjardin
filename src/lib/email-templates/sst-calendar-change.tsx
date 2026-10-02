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

interface ChangeLine {
  label: string;
  from: string | null;
  to: string | null;
}

interface ChangeItem {
  summary: string;
  whenLabel: string;
  lines: ChangeLine[];
}

interface Props {
  changes?: ChangeItem[];
  calendarUrl?: string;
}

const describeLine = (line: ChangeLine) =>
  line.from == null && line.to == null
    ? line.label
    : `${line.label} : ${line.from ?? "—"} → ${line.to ?? "—"}`;

const Email = ({ changes = [], calendarUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>
      {changes.length > 1
        ? `${changes.length} modifications sur le calendrier SST`
        : (changes[0]?.summary ?? "Calendrier SST modifié")}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>De la graine au jardin</Text>
          <Text style={tagline}>Calendrier SST — modification</Text>
        </Section>
        <Hr style={hr} />
        <Text style={paragraph}>
          <strong>
            {changes.length > 1
              ? `${changes.length} modifications viennent d'être faites`
              : "Une modification vient d'être faite"}
          </strong>{" "}
          sur le calendrier SST :
        </Text>
        {changes.map((change, index) => (
          <Section key={index} style={card}>
            <Text style={cardTitle}>{change.summary}</Text>
            <Text style={cardWhen}>{change.whenLabel}</Text>
            {change.lines.map((line, lineIndex) => (
              <Text key={lineIndex} style={cardLine}>
                {describeLine(line)}
              </Text>
            ))}
          </Section>
        ))}
        {calendarUrl ? (
          <Section style={buttonSection}>
            <Button href={calendarUrl} style={button}>
              Ouvrir le calendrier SST
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
  subject: (data: Record<string, any>) => {
    const count = Array.isArray(data?.changes) ? data.changes.length : 0;
    return count > 1
      ? `Calendrier SST : ${count} modifications`
      : `Calendrier SST modifié${data?.changes?.[0]?.summary ? ` — ${data.changes[0].summary}` : ""}`;
  },
  displayName: "Calendrier SST (modification)",
  previewData: {
    changes: [
      {
        summary: "Équipe a modifié le chantier Martin (12/10/2026)",
        whenLabel: "Aujourd'hui à 14:32",
        lines: [{ label: "Heures estimées", from: "4", to: "6" }],
      },
    ],
    calendarUrl: "https://crjardin.lovable.app/pilot/calendrier",
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
