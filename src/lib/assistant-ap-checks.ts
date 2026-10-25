// Assistant AP — éléments bloquants / à vérifier d'une fourniture (logique pure).
import type { ApSupply, ApSupplier } from "@/lib/assistant-ap";
import { supplierByName } from "@/lib/assistant-ap-catalogue";

export type ApIssueLevel = "blocking" | "warning";
export interface ApIssue {
  level: ApIssueLevel;
  code: "item" | "supplier" | "supplier_unknown" | "supplier_ambiguous" | "quantity";
  label: string;
}

/** Couleurs de police : rouge = bloquant, orangé = à vérifier. */
export const ISSUE_TEXT_CLASS: Record<ApIssueLevel, string> = {
  blocking: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
};

export function supplyIssues(
  supply: Pick<ApSupply, "item" | "supplier" | "supplier_id" | "quantity" | "mode">,
  suppliers: Pick<ApSupplier, "id" | "name">[],
): ApIssue[] {
  const issues: ApIssue[] = [];
  if (!supply.item.trim())
    issues.push({ level: "blocking", code: "item", label: "Fourniture non nommée" });
  if (supply.mode !== "stock") {
    const name = supply.supplier.trim();
    if (!name && !supply.supplier_id) {
      issues.push({ level: "blocking", code: "supplier", label: "Fournisseur à renseigner" });
    } else if (!supply.supplier_id && !supplierByName(suppliers, name)) {
      issues.push({
        level: "blocking",
        code: /\bou\b|\/|,/i.test(name) ? "supplier_ambiguous" : "supplier_unknown",
        label: /\bou\b|\/|,/i.test(name)
          ? "Fournisseur ambigu — à choisir"
          : "Fournisseur hors catalogue",
      });
    }
  }
  if (!supply.quantity?.trim())
    issues.push({ level: "warning", code: "quantity", label: "Quantité à préciser" });
  return issues;
}

export function worksiteBlockers(
  supplies: ApSupply[],
  suppliers: Pick<ApSupplier, "id" | "name">[],
): { supply: ApSupply; issues: ApIssue[] }[] {
  return supplies
    .filter((s) => s.status !== "ok")
    .map((supply) => ({ supply, issues: supplyIssues(supply, suppliers) }))
    .filter((r) => r.issues.some((i) => i.level === "blocking"));
}

/** Prête pour l'export : au moins une fourniture à commander et plus aucun bloquant. */
export function isReadyForExport(
  supplies: ApSupply[],
  suppliers: Pick<ApSupplier, "id" | "name">[],
): boolean {
  const pending = supplies.filter((s) => s.status === "a_faire" && s.mode !== "stock");
  return pending.length > 0 && worksiteBlockers(supplies, suppliers).length === 0;
}
