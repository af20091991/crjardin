import * as React from 'react'
import { render } from '@react-email/render'
import { EmailAPIError, sendLovableEmail } from '@lovable.dev/email-js'
import { TEMPLATES } from '@/lib/email-templates/registry'

// Server-only. Sends through Lovable's managed email API.
// Kept as a direct send (instead of the shared template helper) because the
// rendered HTML is post-processed per send to inject the open-tracking pixel.

const SITE_NAME = 'CR Jardin'
const SENDER_DOMAIN = 'notify.delagraineaujardin.com'
const FROM_DOMAIN = 'delagraineaujardin.com'
const TRACKING_ORIGIN = 'https://crjardin.lovable.app'

export interface SendReportEmailInput {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, unknown>
}

export type SendReportEmailResult =
  | { success: true }
  | { success: false; reason: 'email_suppressed' }

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

async function logSend(row: {
  messageId: string
  templateName: string
  recipientEmail: string
  status: 'sent' | 'suppressed' | 'failed'
  errorMessage?: string
}): Promise<void> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { error } = await supabaseAdmin.from('email_send_log').insert({
    message_id: row.messageId,
    template_name: row.templateName,
    recipient_email: row.recipientEmail,
    status: row.status,
    error_message: row.errorMessage ?? null,
  })
  if (error) {
    console.error('Failed to write email_send_log', {
      code: error.code,
      message: error.message,
    })
  }
}

export async function sendReportEmail(
  input: SendReportEmailInput,
): Promise<SendReportEmailResult> {
  const apiKey = process.env['LOVABLE_API_KEY']
  if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured')

  const template = TEMPLATES[input.templateName]
  if (!template) {
    throw new Error(
      `Template '${input.templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
    )
  }

  const recipient = template.to || input.recipientEmail
  if (!recipient) throw new Error('Destinataire manquant.')

  const messageId = crypto.randomUUID()
  const templateData = input.templateData ?? {}
  const element = React.createElement(template.component, templateData)
  let html = await render(element)
  const text = await render(element, { plainText: true })

  // Open-tracking pixel tied to this message id.
  const trackingPixel = `<img src="${TRACKING_ORIGIN}/api/public/email-open?m=${messageId}" width="1" height="1" alt="" style="display:none" />`
  html = html.includes('</body>')
    ? html.replace('</body>', `${trackingPixel}</body>`)
    : `${html}${trackingPixel}`

  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData as Record<string, unknown>)
      : template.subject

  try {
    await sendLovableEmail(
      {
        to: recipient,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: 'transactional',
        label: input.templateName,
        idempotency_key: input.idempotencyKey || messageId,
      },
      { apiKey, sendUrl: process.env['LOVABLE_SEND_URL'] },
    )
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      await logSend({
        messageId,
        templateName: input.templateName,
        recipientEmail: recipient,
        status: 'suppressed',
      })
      console.log('Email suppressed', {
        templateName: input.templateName,
        recipient_redacted: redactEmail(recipient),
      })
      return { success: false, reason: 'email_suppressed' }
    }

    const errorMsg = error instanceof Error ? error.message : String(error)
    await logSend({
      messageId,
      templateName: input.templateName,
      recipientEmail: recipient,
      status: 'failed',
      errorMessage: errorMsg.slice(0, 1000),
    })
    throw error
  }

  await logSend({
    messageId,
    templateName: input.templateName,
    recipientEmail: recipient,
    status: 'sent',
  })

  return { success: true }
}
