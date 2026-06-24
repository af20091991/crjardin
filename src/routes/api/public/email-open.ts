import { createFileRoute } from '@tanstack/react-router'

// 1x1 transparent GIF
const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
])

function pixelResponse() {
  return new Response(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

/**
 * Email open tracking pixel. Records the first open time and increments a
 * counter on subsequent opens, then returns a transparent 1x1 GIF.
 */
export const Route = createFileRoute('/api/public/email-open')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const messageId = url.searchParams.get('m')
          if (messageId && /^[a-zA-Z0-9-]{1,64}$/.test(messageId)) {
            const { supabaseAdmin } = await import(
              '@/integrations/supabase/client.server'
            )
            const userAgent =
              request.headers.get('user-agent')?.slice(0, 300) ?? null
            const { data: existing } = await supabaseAdmin
              .from('email_opens')
              .select('open_count')
              .eq('message_id', messageId)
              .maybeSingle()

            if (existing) {
              await supabaseAdmin
                .from('email_opens')
                .update({ open_count: (existing.open_count ?? 1) + 1 })
                .eq('message_id', messageId)
            } else {
              await supabaseAdmin.from('email_opens').insert({
                message_id: messageId,
                user_agent: userAgent,
              })
            }
          }
        } catch (err) {
          console.error('email-open tracking failed', err)
        }
        return pixelResponse()
      },
    },
  },
})
