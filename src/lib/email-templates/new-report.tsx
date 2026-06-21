import React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Link, Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const LINK_MARKER = '{{LIEN}}'

interface Props {
  bodyText?: string
  shareUrl?: string
  subject?: string
}

/** Render one body line, turning the link marker into a clickable private link. */
function renderLine(line: string, shareUrl: string, key: number) {
  const trimmed = line.trim()
  if (trimmed === '') return <Section key={key} style={spacer} />

  const isBullet = trimmed.startsWith('·')
  const style = isBullet ? bullet : paragraph

  if (line.includes(LINK_MARKER)) {
    const [before, after] = line.split(LINK_MARKER)
    return (
      <Text key={key} style={style}>
        {before}
        <Link href={shareUrl} style={privateLink}>{shareUrl}</Link>
        {after}
      </Text>
    )
  }
  return <Text key={key} style={style}>{line}</Text>
}

const Email = ({ bodyText, shareUrl, subject }: Props) => {
  const lines = (bodyText || '').split('\n')
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{subject || 'Votre compte-rendu de jardinage est disponible'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>De la graine au jardin</Text>
            <Text style={tagline}>au rythme de la nature</Text>
          </Section>
          <Hr style={hr} />
          {lines.map((line, i) => renderLine(line, shareUrl || '#', i))}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data?.subject || 'Votre compte-rendu de jardinage est disponible',
  displayName: 'Nouveau compte-rendu',
  previewData: {
    subject: 'Votre compte-rendu de jardinage est disponible',
    shareUrl: 'https://crjardin.lovable.app/partage/exemple',
    bodyText:
      'Bonjour Madame Martin,\n\nVoici votre lien privé : {{LIEN}}\n\nJardinement vôtre,\n\nAnthony Fournier\nDe la graine au jardin',
  },
} satisfies TemplateEntry

const garamond = "Garamond, 'EB Garamond', 'Cormorant Garamond', Georgia, 'Times New Roman', serif"
const main = { backgroundColor: '#ffffff', fontFamily: garamond }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '4px' }
const brand = { fontSize: '22px', fontWeight: 700, color: '#4F8E33', margin: '0', fontFamily: garamond }
const tagline = { fontSize: '14px', color: '#EE8627', margin: '2px 0 0', fontStyle: 'italic' as const, fontFamily: garamond }
const paragraph = { fontSize: '16px', lineHeight: '1.6', color: '#2f3a26', margin: '0 0 12px', fontFamily: garamond }
const bullet = { fontSize: '16px', lineHeight: '1.5', color: '#2f3a26', margin: '0 0 4px 12px', fontFamily: garamond }
const spacer = { height: '8px' }
const privateLink = { color: '#4F8E33', fontWeight: 700, textDecoration: 'underline', fontFamily: garamond }
const hr = { borderColor: '#e6e6e6', margin: '16px 0 20px' }
