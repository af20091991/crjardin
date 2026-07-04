import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface IpGeo {
  city?: string;
  region?: string;
  country?: string;
  isp?: string;
}

function isPublicIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === "::1" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
  return true;
}

/** Géolocalise une liste d'adresses IP (service gratuit ipwho.is, sans clé). */
export const geolocateIps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ips: string[] }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Réservé à l'administrateur");

    const ips = [...new Set((data.ips ?? []).filter(isPublicIp))].slice(0, 60);
    const out: Record<string, IpGeo> = {};

    await Promise.all(
      ips.map(async (ip) => {
        try {
          const res = await fetch(
            `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country,connection`,
          );
          const j = (await res.json()) as {
            success?: boolean;
            city?: string;
            region?: string;
            country?: string;
            connection?: { isp?: string };
          };
          if (j.success) {
            out[ip] = {
              city: j.city || undefined,
              region: j.region || undefined,
              country: j.country || undefined,
              isp: j.connection?.isp || undefined,
            };
          }
        } catch {
          /* IP non résolue : ignorée */
        }
      }),
    );

    return out;
  });
