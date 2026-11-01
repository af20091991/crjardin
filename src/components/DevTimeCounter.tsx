import { useEffect, useRef, useState } from "react";
import { useIsAdmin } from "@/hooks/use-admin";
import { addDevTime, DEV_TIME_BASE_HOURS, fetchDevTime } from "@/lib/dev-time";

const HEARTBEAT_MS = 60_000;

/**
 * Compteur de temps de développement. Le temps n'est mesuré que lorsque l'admin
 * a PP ouvert et visible ; il est enregistré côté serveur toutes les 60 s.
 */
export function DevTimeCounter() {
  const { isAdmin } = useIsAdmin();
  const [base, setBase] = useState(DEV_TIME_BASE_HOURS);
  const [measured, setMeasured] = useState(0);
  const [pending, setPending] = useState(0);
  const pendingRef = useRef(0);

  useEffect(() => {
    fetchDevTime()
      .then((s) => {
        setBase(s.base_hours);
        setMeasured(s.measured_seconds);
      })
      .catch(() => undefined);
  }, []);

  // Comptage local chaque seconde, uniquement onglet visible et admin.
  useEffect(() => {
    if (!isAdmin) return;
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") {
        pendingRef.current += 1;
        setPending(pendingRef.current);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [isAdmin]);

  // Envoi périodique et à la sortie de l'onglet.
  useEffect(() => {
    if (!isAdmin) return;
    const flush = async () => {
      const toSend = Math.min(pendingRef.current, 120);
      if (toSend <= 0) return;
      pendingRef.current -= toSend;
      setPending(pendingRef.current);
      try {
        const s = await addDevTime(toSend);
        setMeasured(s.measured_seconds);
        setBase(s.base_hours);
      } catch {
        pendingRef.current += toSend;
        setPending(pendingRef.current);
      }
    };
    const interval = setInterval(() => void flush(), HEARTBEAT_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [isAdmin]);

  const totalHours = base + (measured + pending) / 3600;
  return (
    <span className="tabular-nums">
      {totalHours.toLocaleString("fr-FR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} h
    </span>
  );
}
