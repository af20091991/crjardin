export interface MaintenanceDeadline {
  id: string;
  equipment_id: string;
  next_due_date: string;
  equipment_name: string;
  maintenance_type_name: string;
}

/** Keep manual deadlines unless a recurring schedule already tracks that record. */
export function mergeMaintenanceDeadlines<
  S extends MaintenanceDeadline & { last_maintenance_id: string | null },
  M extends {
    id: string;
    equipment_id: string;
    next_due_date: string | null;
    description: string;
    equipment?: { name: string | null } | null;
  },
>(schedules: S[], manual: M[]): MaintenanceDeadline[] {
  const linked = new Set(schedules.map((row) => row.last_maintenance_id).filter(Boolean));
  return [
    ...schedules,
    ...manual.flatMap((row) =>
      row.next_due_date && !linked.has(row.id)
        ? [
            {
              id: row.id,
              equipment_id: row.equipment_id,
              next_due_date: row.next_due_date,
              equipment_name: row.equipment?.name ?? "—",
              maintenance_type_name: row.description,
            },
          ]
        : [],
    ),
  ].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
}
