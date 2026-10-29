import type { ReactNode } from "react";
import { MessageSquare } from "lucide-react";
import { mapPlatform, routeHref, smsHref, telHref } from "@/lib/contact-links";

const linkClass = "underline-offset-2 hover:underline hover:text-foreground";

/** Numéro cliquable : appel, avec un bouton SMS à côté. */
export function PhoneActions({
  phone,
  children,
}: {
  phone: string | null | undefined;
  children?: ReactNode;
}) {
  const tel = phone ? telHref(phone) : undefined;
  const sms = phone ? smsHref(phone) : undefined;
  if (!tel) return <>{children ?? phone ?? ""}</>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <a href={tel} className={linkClass} onClick={(e) => e.stopPropagation()}>
        {children ?? phone}
      </a>
      {sms && (
        <a
          href={sms}
          aria-label="Envoyer un SMS"
          title="Envoyer un SMS"
          className="rounded p-0.5 text-primary hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  );
}

/** Adresse cliquable : ouvre l'itinéraire dans l'appli cartes du téléphone. */
export function AddressLink({
  address,
  children,
}: {
  address: string | null | undefined;
  children?: ReactNode;
}) {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const href = address ? routeHref(address, mapPlatform(ua)) : undefined;
  if (!href) return <>{children ?? address ?? ""}</>;
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={linkClass}
      title="Itinéraire"
      onClick={(e) => e.stopPropagation()}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children ?? address}
    </a>
  );
}
