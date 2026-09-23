// Prévisionnel total HT des ventes d'un mois : cumul de TOUTES les lignes de
// vente saisies sur ce mois, quel que soit leur statut (pastille de couleur).
// Le périmètre temporel reste celui du mode global :
//  - « À date » (défaut) : les mois/lignes futurs sont exclus ;
//  - « Année complète » : les ventes futures déjà saisies sont incluses.
// Aucun autre indicateur ni règle métier n'est concerné.
import { keepRealizedYearMonth, type AsOfOptions } from "@/lib/pilot-realized";
import type { CaEntry } from "@/lib/pilot-ca";
import type { PilotEntry } from "@/lib/pilot";

export function monthForecastHt(
  entries: CaEntry[] | PilotEntry[],
  month: number,
  options?: AsOfOptions,
): number {
  return entries
    .filter(
      (e) =>
        (!("kind" in e) || e.kind === "vente") &&
        Number("month" in e ? e.month : new Date(e.entry_date).getMonth() + 1) === month &&
        keepRealizedYearMonth(
          {
            year: Number("year" in e ? e.year : new Date(e.entry_date).getFullYear()),
            month: Number("month" in e ? e.month : new Date(e.entry_date).getMonth() + 1),
            entry_date: e.entry_date,
          },
          options,
        ),
    )
    .reduce((s, e) => s + (("amount_ht_raw" in e ? e.amount_ht_raw : e.amount_ht) || 0), 0);
}
