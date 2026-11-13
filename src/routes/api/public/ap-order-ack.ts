import { createFileRoute } from '@tanstack/react-router'

// Accusé de réception d'une commande fournisseur : le lien du mail enregistre la date
// dans le journal Assistant AP (ap_order_sends.acknowledged_at). Jeton = ack_token (UUID).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function page(title: string, message: string, status: number): Response {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f4f5f2;font-family:Arial,Helvetica,sans-serif;color:#222">
<div style="max-width:480px;margin:64px auto;background:#fff;border-radius:8px;border-top:4px solid #2f6b3a;padding:28px 32px">
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1><p style="margin:0;font-size:15px;line-height:1.5">${message}</p>
</div></body></html>`
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export const Route = createFileRoute('/api/public/ap-order-ack')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get('t') ?? ''
        if (!UUID.test(token)) {
          return page('Lien invalide', 'Ce lien d’accusé de réception n’est pas valide.', 400)
        }
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
          // Table hors types générés : même approche que le reste de l'Assistant AP.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table hors types générés
          const { data, error } = await (supabaseAdmin.from as any)('ap_order_sends')
            .update({ acknowledged_at: new Date().toISOString() })
            .eq('ack_token', token)
            .is('acknowledged_at', null)
            .select('id')
          if (error) throw error
          if (!data || data.length === 0) {
            return page(
              'Accusé déjà enregistré',
              'La réception de cette commande a déjà été confirmée. Merci.',
              200,
            )
          }
          return page(
            'Réception confirmée',
            'Merci, votre accusé de réception de la commande a bien été enregistré.',
            200,
          )
        } catch (err) {
          console.error('ap-order-ack failed', err)
          return page(
            'Erreur',
            'L’accusé de réception n’a pas pu être enregistré. Merci de répondre directement au mail.',
            500,
          )
        }
      },
    },
  },
})
