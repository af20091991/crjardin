import { useEffect, useState } from "react";
import { DEV_TIME_BASE_HOURS, fetchDevTime } from "@/lib/dev-time";

const REFRESH_MS = 60_000;

/**
 * Total du temps de développement de PP : base de départ + temps déclaré par Claude et les
 * autres IA (journal dev_time_log). Le temps passé à utiliser PP n'est pas compté.
 */
export function DevTimeCounter() {
  const [base, setBase] = useState(DEV_TIME_BASE_HOURS);
  const [measured, setMeasured] = useState(0);

  useEffect(() => {
    const load = () =>
      fetchDevTime()
        .then((s) => {
          setBase(s.base_hours);
          setMeasured(s.measured_seconds);
        })
        .catch(() => undefined);
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const totalHours = Math.round(base + measured / 3600);
  return <span className="tabular-nums">{`${totalHours.toLocaleString("fr-FR")} h`}</span>;
}
