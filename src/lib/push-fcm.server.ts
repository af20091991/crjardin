/** Envoi de notifications push via Firebase Cloud Messaging (API HTTP v1).
 *  Secret requis : FIREBASE_SERVICE_ACCOUNT (JSON du compte de service Firebase). */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function readServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    return sa.project_id && sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`FCM auth ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export interface PushMessage {
  title: string;
  body?: string | null;
  url: string;
}

/** Envoie le message à chaque jeton ; retourne les jetons devenus invalides (à supprimer). */
export async function sendPush(
  sa: ServiceAccount,
  tokens: string[],
  msg: PushMessage,
): Promise<{ sent: number; invalid: string[] }> {
  const bearer = await accessToken(sa);
  const invalid: string[] = [];
  let sent = 0;
  await Promise.all(
    tokens.map(async (token) => {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: msg.title, body: msg.body ?? undefined },
              data: { url: msg.url },
              android: { priority: "HIGH", notification: { channel_id: "default" } },
            },
          }),
        },
      );
      if (res.ok) sent++;
      else if (res.status === 404 || res.status === 400) invalid.push(token);
    }),
  );
  return { sent, invalid };
}

/** Page à ouvrir au toucher de la notification. */
export function notificationUrl(n: { type: string; client_id: string | null }): string {
  if (n.type === "sst_calendar") return "/pilot/calendrier";
  if (n.client_id) return `/clients/${n.client_id}`;
  return "/";
}
