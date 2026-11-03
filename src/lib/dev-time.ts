import { supabase } from "@/integrations/supabase/client";

export const DEV_TIME_BASE_HOURS = 695;

export interface DevTimeState {
  base_hours: number;
  measured_seconds: number;
}

/** Total du développement : base de départ + temps déclaré par les IA (lecture seule dans l'appli). */
export async function fetchDevTime(): Promise<DevTimeState> {
  const { data, error } = await supabase
    .from("app_dev_time")
    .select("base_hours, measured_seconds")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return {
    base_hours: Number(data?.base_hours ?? DEV_TIME_BASE_HOURS),
    measured_seconds: Number(data?.measured_seconds ?? 0),
  };
}
