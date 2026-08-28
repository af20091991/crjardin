import { sendTransactionalEmailFn } from './send.functions'
import type { SendTransactionalEmailInput } from './send.functions'

export type { SendTransactionalEmailInput }

/** Envoie un e-mail applicatif via l'infrastructure e-mail gérée (côté serveur). */
export async function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  return sendTransactionalEmailFn({ data: input })
}
