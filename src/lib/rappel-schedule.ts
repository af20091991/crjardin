// Calcul des rappels d'intervention Premium à notifier.
// Un rappel est dû dès que l'instant courant atteint « scheduled_at − délai ».

export interface ReminderItem {
  id: string;
  scheduled_at: string | null;
  reminder_hours: number[];
}

export interface DueReminder {
  itemId: string;
  hours: number;
  dueAt: Date;
}

export function dueReminders(
  items: ReminderItem[],
  alreadyNotified: Set<string>, // clés `${itemId}:${hours}`
  now: Date,
): DueReminder[] {
  const due: DueReminder[] = [];
  for (const item of items) {
    if (!item.scheduled_at) continue;
    const start = new Date(item.scheduled_at).getTime();
    for (const hours of item.reminder_hours) {
      const dueAt = new Date(start - hours * 3600_000);
      if (now.getTime() < dueAt.getTime()) continue;
      if (alreadyNotified.has(`${item.id}:${hours}`)) continue;
      // Ne pas relancer un rappel dont l'intervention est déjà passée.
      if (now.getTime() >= start) continue;
      due.push({ itemId: item.id, hours, dueAt });
    }
  }
  return due;
}
