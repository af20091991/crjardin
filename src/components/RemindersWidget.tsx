import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listReminders, addReminder, toggleReminder, deleteReminder } from "@/lib/reminders";
import { listClients } from "@/lib/clients";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Plus, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";

export function RemindersWidget() {
  const qc = useQueryClient();
  const { data: reminders } = useQuery({ queryKey: ["reminders"], queryFn: listReminders });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [clientId, setClientId] = useState("none");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["reminders"] });
  const add = useMutation({
    mutationFn: () => addReminder({ title, due_date: due || null, client_id: clientId === "none" ? null : clientId }),
    onSuccess: () => { setTitle(""); setDue(""); setClientId("none"); setOpen(false); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => toggleReminder(id, done),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteReminder, onSuccess: invalidate });

  const clientName = (id: string | null) => id ? clients?.find((c) => c.id === id)?.name : null;
  const items = reminders ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
            <Bell className="h-5 w-5 text-primary" /> Rappels & tâches
          </h3>
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter
          </Button>
        </div>

        {open && (
          <div className="space-y-2 rounded-lg border p-3">
            <Input placeholder="Ex. Rappeler M. Dupont pour la taille" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-40" />
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Client (facultatif)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun client</SelectItem>
                  {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!title.trim() || add.isPending} onClick={() => add.mutate()}>Enregistrer</Button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Aucun rappel. Planifiez vos prochaines tâches.</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((r) => {
              const overdue = !r.done && r.due_date && r.due_date < today;
              return (
                <li key={r.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Checkbox checked={r.done} onCheckedChange={(v) => toggle.mutate({ id: r.id, done: !!v })} aria-label="Marquer fait" />
                  <div className="min-w-0 flex-1">
                    <p className={r.done ? "text-muted-foreground line-through" : ""}>{r.title}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {r.due_date && <span className={overdue ? "font-medium text-destructive" : ""}><CalendarClock className="mr-0.5 inline h-3 w-3" />{new Date(r.due_date).toLocaleDateString("fr-FR")}</span>}
                      {clientName(r.client_id) && <span>· {clientName(r.client_id)}</span>}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="Supprimer" onClick={() => remove.mutate(r.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
