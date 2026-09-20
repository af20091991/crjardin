import React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Hr,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  clientName?: string;
  actionText?: string;
  contentPreview?: string;
  clientUrl?: string;
}

const Email = ({ clientName, actionText, contentPreview, clientUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{`${clientName ?? "Un client"} ${actionText ?? "a une nouvelle activité"}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>De la graine au jardin</Text>
          <Text style={tagline}>au rythme de la nature</Text>
        </Section>
        <Hr style={hr} />
        <Text style={paragraph}>
          <strong>{clientName}</strong> {actionText}.
        </Text>
        {contentPreview && <Text style={quote}>{contentPreview}</Text>}
        {clientUrl && (
          <Text style={paragraph}>
            <Link href={clientUrl} style={privateLink}>
              Ouvrir la fiche client
            </Link>
          </Text>
        )}
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => {
    const isDocument = data?.actionText === "a ajouté un document";
    return `${isDocument ? "Nouveau document" : "Nouveau message"} de ${data?.clientName ?? "votre client"}`;
  },
  displayName: "Activité client (message / document)",
  previewData: {
    clientName: "Mme Martin",
    actionText: "a ajouté un document",
    contentPreview: "Facture chaudière",
    clientUrl: "https://crjardin.lovable.app/clients/exemple",
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
const privateLink = {
  color: "#4F8E33",
  fontWeight: 700,
  textDecoration: "underline",
  fontFamily: garamond,
};
const hr = { borderColor: "#e6e6e6", margin: "16px 0 20px" };
