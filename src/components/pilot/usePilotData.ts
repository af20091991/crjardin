import { useQuery } from "@tanstack/react-query";
import { listEntries, listCharges, getSettings } from "@/lib/pilot";
import { listClients } from "@/lib/clients";

export function usePilotData() {
  const entries = useQuery({ queryKey: ["pilot-entries"], queryFn: listEntries });
  const charges = useQuery({ queryKey: ["pilot-charges"], queryFn: listCharges });
  const settings = useQuery({ queryKey: ["pilot-settings"], queryFn: getSettings });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  return { entries, charges, settings, clients };
}