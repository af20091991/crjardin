import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export interface SendTransactionalEmailInput {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, unknown>
}

export const sendTransactionalEmailFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SendTransactionalEmailInput) => {
    if (!data?.templateName) throw new Error('templateName is required')
    if (!data?.recipientEmail) throw new Error('recipientEmail is required')
    return data
  })
  .handler(async ({ data }) => {
    const { sendReportEmail } = await import('./report-send.server')
    return sendReportEmail(data)
  })
