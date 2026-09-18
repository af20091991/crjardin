import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Save, Settings2, Trash2, X } from "lucide-react";
import {
  createMaintenanceType,
  listEquipmentTypes,
  listMaintenanceRuleIds,
  listMaintenanceTypes,
  listMaintenanceUsageCounts,
  setEquipmentTypeMaintenanceTypes,
  updateMaintenanceType,
  deleteMaintenanceType,
  type EquipmentType,
  type MaintenanceType,
} from "@/lib/parc-materiel";

export function MaintenanceRulesDialog({ onChanged }: { onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [maintenanceName, setMaintenanceName] = useState("");
  const [intervalMonths, setIntervalMonths] = useState("");
  const [reminderDays, setReminderDays] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedMaintenanceIds, setSelectedMaintenanceIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const types = useQuery({
    queryKey: ["parc-materiel", "equipment-types"],
    queryFn: listEquipmentTypes,
    enabled: open,
  });
  const maintenanceTypes = useQuery({
    queryKey: ["parc-materiel", "maintenance-types"],
    queryFn: listMaintenanceTypes,
    enabled: open,
  });
  const usageCounts = useQuery({
    queryKey: ["parc-materiel", "maintenance-usage"],
    queryFn: listMaintenanceUsageCounts,
    enabled: open,
  });

  useEffect(() => {
    if (!selectedTypeId) {
      setSelectedMaintenanceIds([]);
      return;
    }
    listMaintenanceRuleIds(selectedTypeId)
      .then(setSelectedMaintenanceIds)
      .catch((e: Error) => toast.error(e.message));
  }, [selectedTypeId]);

  function resetForm() {
    setMaintenanceName("");
    setIntervalMonths("");
    setReminderDays("");
    setEditingId(null);
  }

  function startEdit(type: MaintenanceType) {
    setEditingId(type.id);
    setMaintenanceName(type.name);
    setIntervalMonths(String(type.interval_months));
    setReminderDays(String(type.reminder_days));
  }

  const saveMaintenance = useMutation({
    mutationFn: () => {
      const input = {
        name: maintenanceName.trim(),
        interval_months: Number(intervalMonths),
        reminder_days: Number(reminderDays),
      };
      if (
        !input.name ||
        !Number.isInteger(input.interval_months) ||
        input.interval_months <= 0 ||
        !Number.isInteger(input.reminder_days) ||
        input.reminder_days < 0
      ) {
        throw new Error("Renseigne un nom, une fréquence en mois et un rappel valides.");
      }
      return editingId ? updateMaintenanceType(editingId, input) : createMaintenanceType(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parc-materiel", "maintenance-types"] });
      queryClient.invalidateQueries({ queryKey: ["parc-materiel", "maintenance-usage"] });
      queryClient.invalidateQueries({ queryKey: ["parc-materiel"] });
      onChanged?.();
      toast.success(editingId ? "Intervention modifiée." : "Intervention créée.");
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMaintenance = useMutation({
    mutationFn: (id: string) => deleteMaintenanceType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parc-materiel", "maintenance-types"] });
      queryClient.invalidateQueries({ queryKey: ["parc-materiel", "maintenance-usage"] });
      queryClient.invalidateQueries({ queryKey: ["parc-materiel"] });
      onChanged?.();
      toast.success("Intervention supprimée.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRules = useMutation({
    mutationFn: () => setEquipmentTypeMaintenanceTypes(selectedTypeId, selectedMaintenanceIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parc-materiel"] });
      queryClient.invalidateQueries({ queryKey: ["parc-materiel", "maintenance-usage"] });
      onChanged?.();
      toast.success("Affectation enregistrée.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleMaintenance(id: string) {
    setSelectedMaintenanceIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings2 className="mr-1 h-3.5 w-3.5" />
          Entretien
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Entretien du parc matériel</DialogTitle>
          <DialogDescription>
            Crée tes interventions, puis affecte-les aux types de matériel concernés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-medium">Catalogue des interventions</h3>
                <p className="text-xs text-muted-foreground">Aucune intervention n'est prédéfinie.</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_100px_100px_auto_auto]">
              <Input
                value={maintenanceName}
                onChange={(e) => setMaintenanceName(e.target.value)}
                placeholder="Nom de l'intervention"
              />
              <Input
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(e.target.value)}
                inputMode="numeric"
                placeholder="Mois"
              />
              <Input
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                inputMode="numeric"
                placeholder="Rappel (j)"
              />
              <Button
                size="icon"
                onClick={() => saveMaintenance.mutate()}
                disabled={saveMaintenance.isPending}
              >
                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </Button>
              {editingId ? (
                <Button size="icon" variant="ghost" onClick={resetForm} title="Annuler la modification">
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <span />
              )}
            </div>

            <div className="space-y-2">
              {(maintenanceTypes.data ?? []).map((type: MaintenanceType) => (
                <div
                  key={type.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{type.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Tous les {type.interval_months} mois · rappel {type.reminder_days} j avant ·{" "}
                      {usageCounts.data?.[type.id] ?? 0} type
                      {(usageCounts.data?.[type.id] ?? 0) > 1 ? "s" : ""} de matériel
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEdit(type)}
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if ((usageCounts.data?.[type.id] ?? 0) > 0) {
                        toast.error("Cette intervention est encore affectée à un type de matériel.");
                        return;
                      }
                      if (window.confirm(`Supprimer « ${type.name} » ?`)) {
                        removeMaintenance.mutate(type.id);
                      }
                    }}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {maintenanceTypes.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune intervention créée.</p>
              )}
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <div>
              <h3 className="font-medium">Affectation au matériel</h3>
              <p className="text-xs text-muted-foreground">Choisis un type de matériel, puis coche les interventions qui lui correspondent.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(types.data ?? []).map((type: EquipmentType) => (
                <Button
                  key={type.id}
                  size="sm"
                  variant={selectedTypeId === type.id ? "default" : "outline"}
                  onClick={() => setSelectedTypeId(type.id)}
                >
                  {type.name}
                </Button>
              ))}
              {types.data?.length === 0 && <p className="text-sm text-muted-foreground">Aucun type de matériel créé.</p>}
            </div>
            {selectedTypeId && (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(maintenanceTypes.data ?? []).map((type: MaintenanceType) => (
                    <label key={type.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                      <input type="checkbox" checked={selectedMaintenanceIds.includes(type.id)} onChange={() => toggleMaintenance(type.id)} />
                      <span className="text-sm">{type.name}</span>
                    </label>
                  ))}
                </div>
                <DialogFooter>
                  <Button onClick={() => saveRules.mutate()} disabled={saveRules.isPending}>
                    <Save className="mr-1 h-3.5 w-3.5" />
                    Enregistrer l'affectation
                  </Button>
                </DialogFooter>
              </>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
