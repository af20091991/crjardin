import React from "react";
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  clientLabel?: string;
  dateLabel?: string;
  offsetLabel?: string;
  supplies?: string[];
  suppliers?: string[];
  fulfillments?: string[];
  okItems?: string[];
  todoItems?: string[];
  followUpItems?: string[];
  notes?: string | null;
}

const List = ({ title, items }: { title: string; items: string[] }) =>
  items.length ? (
    <Section>
      <Text style={sectionTitle}>{title}</Text>
      {items.map((line, i) => (
        <Text key={i} style={listItem}>
          • {line}
        </Text>
      ))}
    </Section>
  ) : null;

const Email = ({
  clientLabel,
  dateLabel,
  offsetLabel,
  supplies = [],
  suppliers = [],
  fulfillments = [],
  okItems = [],
  todoItems = [],
  followUpItems = [],
  notes,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{`${offsetLabel ?? "Rappel"} — ${clientLabel ?? "chantier"} (${dateLabel ?? ""})`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>De la graine au jardin</Text>
          <Text style={tagline}>au rythme de la nature</Text>
        </Section>
        <Hr style={hr} />
        <Text style={paragraph}>
          <strong>{offsetLabel ?? "Rappel"}</strong> — approvisionnements du chantier{" "}
          <strong>{clientLabel}</strong>, réalisation prévue le <strong>{dateLabel}</strong>.
        </Text>
        <List title="Approvisionnements" items={supplies} />
        <List title="Fournisseurs" items={suppliers} />
        <List title="Retraits / livraisons" items={fulfillments} />
        <List title="Éléments OK" items={okItems} />
        <List title="Reste à faire" items={todoItems} />
        <List title="À relancer" items={followUpItems} />
        {notes ? (
          <Section>
            <Text style={sectionTitle}>Notes</Text>
            <Text style={quote}>{notes}</Text>
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
    `${data?.offsetLabel ?? "Rappel"} — ${data?.clientLabel ?? "chantier"} du ${data?.dateLabel ?? ""}`,
  displayName: "Assistant AP (rappel approvisionnements)",
  previewData: {
    clientLabel: "Chauveau AP",
    dateLabel: "19/10/2026",
    offsetLabel: "J-10",
    supplies: ["AEF — Vivaces et arbustes (À faire, Livraison)"],
    suppliers: ["AEF", "Touchat"],
    fulfillments: ["AEF — Vivaces : livraison le 02/11/2026"],
    okItems: ["AEF — Vivaces"],
    todoItems: ["Touchat — Orgasyl x11"],
    followUpItems: [],
    notes: "Colonne commande/réservation vide au document : à vérifier.",
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
const sectionTitle = {
  fontSize: "15px",
  fontWeight: 700,
  color: "#4F8E33",
  margin: "14px 0 4px",
  fontFamily: garamond,
};
const listItem = {
  fontSize: "15px",
  lineHeight: "1.5",
  color: "#2f3a26",
  margin: "0 0 2px",
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
