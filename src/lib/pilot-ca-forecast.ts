// Prévisionnel total HT des ventes d'un mois : cumul de TOUTES les lignes de
// vente saisies sur ce mois, quel que soit leur statut (pastille de couleur).
// Le périmètre temporel reste celui du mode global :
//  - « À date » (défaut) : les mois/lignes futurs sont exclus ;
//  - « Année complète » : les ventes futures déjà saisies sont incluses.
// Aucun autre indicateur ni règle métier n'est concerné.
import { keepRealizedYearMonth, type AsOfOptions } from "@/lib/pilot-realized";
import type { CaEntry } from "@/lib/pilot-ca";

export function monthForecastHt(
  entries: CaEntry[],
  month: number,
  options?: AsOfOptions,
): number {
  return entries
    .filter(
      (e) =>
        e.kind === "vente" &&
        Number(e.month) === month &&
        keepRealizedYearMonth(
          { year: Number(e.year), month: Number(e.month), entry_date: e.entry_date },
          options,
        ),
    )
    .reduce((s, e) => s + (e.amount_ht || 0), 0);
}
