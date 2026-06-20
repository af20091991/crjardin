import { supabase } from "@/integrations/supabase/client";

export interface Reminder {
  id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
  updated_at: string;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export async function listReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .order("done", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as Reminder[];
}

export async function addReminder(input: { title: string; due_date?: string | null; client_id?: string | null }): Promise<Reminder> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("reminders")
    .insert({ user_id, title: input.title, due_date: input.due_date ?? null, client_id: input.client_id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Reminder;
}

export async function toggleReminder(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from("reminders").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) throw error;
}
