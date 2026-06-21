import React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  reportTitle?: string
  reportDate?: string
  shareUrl?: string
  senderName?: string
}

const Email = ({ clientName, reportTitle, reportDate, shareUrl, senderName }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre nouveau compte-rendu de jardinage est disponible</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>De la graine au jardin</Text>
          <Text style={tagline}>au rythme de la nature</Text>
        </Section>
        <Heading style={h1}>Nouveau compte-rendu disponible</Heading>
        <Text style={text}>Bonjour {clientName || ''},</Text>
        <Text style={text}>
          Un nouveau compte-rendu{reportTitle ? ` « ${reportTitle} »` : ''}
          {reportDate ? `, du ${reportDate},` : ''} concernant l'entretien de votre jardin
          est désormais consultable en ligne.
        </Text>
        {shareUrl ? (
          <Section style={btnWrap}>
            <Button href={shareUrl} style={button}>Consulter mon compte-rendu</Button>
          </Section>
        ) : null}
        <Text style={textMuted}>
          Vous pouvez consulter votre suivi à tout moment, depuis votre téléphone ou votre ordinateur.
        </Text>
        <Hr style={hr} />
        <Text style={signature}>
          {senderName || 'De la graine au jardin'}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data?.reportTitle
      ? `Nouveau compte-rendu : ${data.reportTitle}`
      : 'Votre nouveau compte-rendu de jardinage est disponible',
  displayName: 'Nouveau compte-rendu',
  previewData: {
    clientName: 'Madame Martin',
    reportTitle: 'Taille des haies',
    reportDate: '21 juin 2026',
    shareUrl: 'https://crjardin.lovable.app/partage/exemple',
    senderName: 'De la graine au jardin',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '8px' }
const brand = { fontSize: '20px', fontWeight: 700, color: '#4F8E33', margin: '0' }
const tagline = { fontSize: '13px', color: '#EE8627', margin: '2px 0 0', fontStyle: 'italic' as const }
const h1 = { fontSize: '22px', color: '#2f3a26', margin: '24px 0 12px' }
const text = { fontSize: '15px', lineHeight: '1.6', color: '#333333', margin: '0 0 12px' }
const textMuted = { fontSize: '13px', lineHeight: '1.6', color: '#777777', margin: '12px 0 0' }
const btnWrap = { textAlign: 'center' as const, margin: '24px 0' }
const button = {
  backgroundColor: '#4F8E33', color: '#ffffff', padding: '12px 24px',
  borderRadius: '8px', fontSize: '15px', fontWeight: 600, textDecoration: 'none',
}
const hr = { borderColor: '#eeeeee', margin: '24px 0 16px' }
const signature = { fontSize: '14px', color: '#4F8E33', fontWeight: 600, margin: '0' }