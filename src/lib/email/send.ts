import { supabase } from '@/integrations/supabase/client'

export interface SendTransactionalEmailInput {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, unknown>
}

/** POST to the app's transactional email route with the signed-in user's JWT. */
export async function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Vous devez être connecté pour envoyer un e-mail.')

  const res = await fetch('/lovable/email/transactional/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    let message = "L'envoi de l'e-mail a échoué."
    try {
      const err = await res.json()
      if (err?.error) message = err.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return res.json()
}