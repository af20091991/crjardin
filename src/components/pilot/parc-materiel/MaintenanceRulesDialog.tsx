import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Save, Wrench } from "lucide-react";
import {
  createEquipmentType,
  createMaintenanceType,
  listEquipmentTypes,
  listMaintenanceRuleIds,
  listMaintenanceTypes,
  setEquipmentTypeMaintenanceTypes,
  type EquipmentType,
  type MaintenanceType,
} from "@/lib/parc-materiel";

export function MaintenanceRulesDialog({ onChanged }: { onChanged?: () => void }) {
  const [equipmentTypeName, setEquipmentTypeName] = useState("");
  const [maintenanceName, setMaintenanceName] = useState("");
  const [intervalMonths, setIntervalMonths] = useState("");
  const [reminderDays, setReminderDays] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedMaintenanceIds, setSelectedMaintenanceIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const types = useQuery({
    queryKey: ["parc-materiel", "equipment-types"],
    queryFn: listEquipmentTypes,
  });
  const maintenanceTypes = useQuery({
    queryKey: ["parc-materiel", "maintenance-types"],
    queryFn: listMaintenanceTypes,
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

  const addEquipmentType = useMutation({
    mutationFn: () => createEquipmentType(equipmentTypeName),
    onSuccess: (row) => {
      setEquipmentTypeName("");
      queryClient.invalidateQueries({ queryKey: ["parc-materiel", "equipment-types"] });
      setSelectedTypeId(row.id);
      toast.success("Type de matériel ajouté.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMaintenanceType = useMutation({
    mutationFn: () =>
      createMaintenanceType({
        name: maintenanceName,
        interval_months: Number(intervalMonths),
        reminder_days: Number(reminderDays),
      }),
    onSuccess: () => {
      setMaintenanceName("");
      setIntervalMonths("");
      setReminderDays("");
      queryClient.invalidateQueries({ queryKey: ["parc-materiel", "maintenance-types"] });
      toast.success("Intervention ajoutée au catalogue.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRules = useMutation({
    mutationFn: () => setEquipmentTypeMaintenanceTypes(selectedTypeId, selectedMaintenanceIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parc-materiel"] });
      onChanged?.();
      toast.success("Affectation enregistrée.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleMaintenance(id: string) {
    setSelectedMaintenanceIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  const canAddMaintenance =
    maintenanceName.trim().length > 0 &&
    Number(intervalMonths) > 0 &&
    Number(reminderDays) >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-4 w-4 text-primary" />
          Gestion des entretiens récurrents
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Crée ton catalogue complet d'interventions, puis affecte les interventions
          nécessaires à chaque type de matériel. Aucun entretien n'est prédéfini.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
          <section className="rounded-lg border border-border p-4">
            <div className="mb-3">
              <h3 className="font-medium">Catalogue des interventions</h3>
              <p className="text-xs text-muted-foreground">
                Chaque intervention créée apparaît ensuite dans la liste d'affectation.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_110px_100px_auto]">
              <Input
                value={maintenanceName}
                onChange={(e) => setMaintenanceName(e.target.value)}
                placeholder="Nom de l'intervention"
              />
              <Input
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(e.target.value)}
                inputMode="numeric"
                placeholder="Périodicité (mois)"
              />
              <Input
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                inputMode="numeric"
                placeholder="Rappel (j)"
              />
              <Button
                size="icon"
                onClick={() => addMaintenanceType.mutate()}
                disabled={!canAddMaintenance || addMaintenanceType.isPending}
                aria-label="Ajouter l'intervention"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tu définis toi-même la périodicité et le délai de rappel de chaque intervention.
            </p>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {(maintenanceTypes.data ?? []).map((type: MaintenanceType) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{type.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Tous les {type.interval_months} mois · rappel {type.reminder_days} j avant
                    </p>
                  </div>
                </div>
              ))}
              {maintenanceTypes.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucune intervention créée.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border p-4">
            <div className="mb-3">
              <h3 className="font-medium">Affectation au matériel</h3>
              <p className="text-xs text-muted-foreground">
                Sélectionne un type de matériel, puis coche les interventions à lui affecter.
              </p>
            </div>
            <div className="mb-4">
              <Label className="text-xs">Type de matériel</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  value={equipmentTypeName}
                  onChange={(e) => setEquipmentTypeName(e.target.value)}
                  placeholder="Créer un type de matériel"
                />
                <Button
                  size="icon"
                  onClick={() => equipmentTypeName.trim() && addEquipmentType.mutate()}
                  disabled={!equipmentTypeName.trim() || addEquipmentType.isPending}
                  aria-label="Ajouter le type de matériel"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(types.data ?? []).map((type: EquipmentType) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedTypeId(type.id)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${selectedTypeId === type.id ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  {type.name}
                </button>
              ))}
              {types.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun type de matériel créé.
                </p>
              )}
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {(maintenanceTypes.data ?? []).map((type: MaintenanceType) => (
                <label
                  key={type.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${selectedMaintenanceIds.includes(type.id) ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedMaintenanceIds.includes(type.id)}
                    onChange={() => toggleMaintenance(type.id)}
                    disabled={!selectedTypeId}
                    className="mt-1"
                  />
                  <span className="min-w-0 text-sm">
                    <span className="block font-medium">{type.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Tous les {type.interval_months} mois · rappel {type.reminder_days} j avant
                    </span>
                  </span>
                </label>
              ))}
              {maintenanceTypes.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Crée d'abord les interventions dans le catalogue.
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => saveRules.mutate()}
                disabled={!selectedTypeId || saveRules.isPending}
              >
                <Save className="mr-1 h-3.5 w-3.5" />
                {saveRules.isPending ? "Enregistrement…" : "Enregistrer l'affectation"}
              </Button>
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
