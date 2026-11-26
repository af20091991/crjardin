import React from "react";
import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  recipientName?: string;
  clientName?: string;
  interventionDate?: string;
  address?: string;
  intervenants?: string;
  tasks?: string[];
  equipment?: string[];
  epi?: string[];
  notes?: string;
  pdfUrl?: string;
}

const Email = ({ recipientName, clientName, interventionDate, address, intervenants, tasks = [], equipment = [], epi = [], notes, pdfUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Fiche méthode SST — {clientName ?? "mission"} · {interventionDate ?? "date à confirmer"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>De la graine au jardin</Text>
          <Text style={tagline}>au rythme de la nature</Text>
        </Section>
        <Hr style={hr} />
        <Text style={paragraph}>Bonjour {recipientName ?? ""},</Text>
        <Text style={paragraph}>Voici la fiche méthode SST pour votre intervention sur la mission suivante. Merci de la consulter avant votre arrivée sur le chantier.</Text>
        <Section style={summary}>
          <Text style={summaryTitle}>Mission</Text>
          <Text style={summaryLine}><strong>Client :</strong> {clientName ?? "—"}</Text>
          <Text style={summaryLine}><strong>Date :</strong> {interventionDate ?? "—"}</Text>
          <Text style={summaryLine}><strong>Adresse :</strong> {address ?? "—"}</Text>
          <Text style={summaryLine}><strong>SST :</strong> {intervenants ?? "—"}</Text>
        </Section>
        <Text style={sectionTitle}>Travaux à réaliser</Text>
        {tasks.length ? tasks.map((task, i) => <Text key={task} style={bullet}>{i + 1}. {task}</Text>) : <Text style={muted}>Aucune tâche renseignée.</Text>}
        <Text style={sectionTitle}>Matériel nécessaire</Text>
        {equipment.length ? equipment.map((item) => <Text key={item} style={bullet}>• {item}</Text>) : <Text style={muted}>Aucun matériel particulier renseigné.</Text>}
        <Text style={sectionTitle}>EPI</Text>
        {epi.length ? epi.map((item) => <Text key={item} style={bullet}>• {item}</Text>) : <Text style={muted}>Aucun EPI spécifique renseigné.</Text>}
        {notes ? <><Text style={sectionTitle}>Notes complémentaires</Text><Text style={quote}>{notes}</Text></> : null}
        <Section style={downloadBox}>
          <Text style={downloadTitle}>Fiche méthode SST complète</Text>
          <Text style={downloadText}>La fiche complète, avec le plan du jardin et les repères de tâches lorsqu’ils sont renseignés, est disponible dans le PDF ci-dessous.</Text>
          {pdfUrl ? <Link href={pdfUrl} style={button}>Ouvrir la fiche méthode SST</Link> : <Text style={muted}>Le lien vers le PDF sera disponible après l’envoi.</Text>}
        </Section>
        <Text style={paragraph}>Merci d’en prendre connaissance avant l’intervention et de prévoir le matériel et les EPI indiqués.</Text>
        <Text style={signature}>Jardinement vôtre,<br /><strong>Anthony Fournier</strong><br />De la graine au jardin</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches TemplateEntry's signature
  subject: (data: Record<string, any>) => `Fiche méthode SST — ${data?.clientName ?? "mission"} · ${data?.interventionDate ?? "date à confirmer"}`,
  displayName: "Fiche méthode SST",
  previewData: { recipientName: "Chloé", clientName: "Mme Martin", interventionDate: "Lundi 5 octobre 2026", address: "12 rue des Oliviers, Montpellier", intervenants: "Chloé, Fanny", tasks: ["Taille de haie sur 2 faces", "Ramassage de feuilles"], equipment: ["Taille-haie double peigne (T)", "Souffleur", "AP500S"], epi: ["Chaussures de sécurité", "Gants", "Lunettes"], notes: "Prévoir l’accès par le portail latéral." },
} satisfies TemplateEntry;

const garamond = "Garamond, 'EB Garamond', 'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const main = { backgroundColor: "#ffffff", fontFamily: garamond };
const container = { padding: "24px", maxWidth: "600px", margin: "0 auto" };
const header = { textAlign: "center" as const, marginBottom: "4px" };
const brand = { fontSize: "22px", fontWeight: 700, color: "#4F8E33", margin: "0", fontFamily: garamond };
const tagline = { fontSize: "14px", color: "#EE8627", margin: "2px 0 0", fontStyle: "italic" as const, fontFamily: garamond };
const paragraph = { fontSize: "16px", lineHeight: "1.6", color: "#2f3a26", margin: "0 0 12px", fontFamily: garamond };
const sectionTitle = { fontSize: "17px", lineHeight: "1.4", color: "#4F8E33", fontWeight: 700, margin: "18px 0 7px", fontFamily: garamond };
const bullet = { fontSize: "15px", lineHeight: "1.5", color: "#2f3a26", margin: "0 0 5px", fontFamily: garamond };
const muted = { fontSize: "14px", lineHeight: "1.5", color: "#77786f", margin: "0 0 8px", fontFamily: garamond };
const summary = { backgroundColor: "#f6f8f3", borderLeft: "3px solid #4F8E33", padding: "10px 14px", margin: "10px 0 16px" };
const summaryTitle = { fontSize: "17px", fontWeight: 700, color: "#4F8E33", margin: "0 0 7px", fontFamily: garamond };
const summaryLine = { fontSize: "15px", lineHeight: "1.5", color: "#2f3a26", margin: "2px 0", fontFamily: garamond };
const quote = { fontSize: "15px", lineHeight: "1.6", color: "#2f3a26", padding: "8px 14px", backgroundColor: "#f6f8f3", borderLeft: "3px solid #4F8E33", margin: "0 0 12px", fontFamily: garamond };
const downloadBox = { textAlign: "center" as const, backgroundColor: "#f6f8f3", borderRadius: "8px", padding: "18px 16px", margin: "22px 0" };
const downloadTitle = { fontSize: "18px", fontWeight: 700, color: "#4F8E33", margin: "0 0 7px", fontFamily: garamond };
const downloadText = { fontSize: "14px", lineHeight: "1.5", color: "#2f3a26", margin: "0 0 14px", fontFamily: garamond };
const button = { display: "inline-block", backgroundColor: "#4F8E33", color: "#ffffff", padding: "10px 18px", borderRadius: "6px", fontSize: "15px", fontWeight: 700, textDecoration: "none", fontFamily: garamond };
const signature = { fontSize: "16px", lineHeight: "1.6", color: "#2f3a26", margin: "18px 0 0", fontFamily: garamond };
const hr = { borderColor: "#e6e6e6", margin: "16px 0 20px" };
