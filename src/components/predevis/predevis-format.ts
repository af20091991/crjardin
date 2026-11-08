import { toast } from "sonner";

export const eur = (n: number | null) =>
  n == null ? "données insuffisantes" : `${n.toFixed(2).replace(".", ",")} €`;

/** Montant prêt à coller (sans symbole). */
export const amount = (n: number | null) => (n == null ? null : n.toFixed(2).replace(".", ","));

export async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copié.`);
  } catch {
    toast.error("Copie impossible dans ce navigateur.");
  }
}
