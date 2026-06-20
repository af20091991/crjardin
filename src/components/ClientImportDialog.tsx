import { useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientForm } from "@/components/ClientForm";
import { parseClientsFile, type ParsedClient } from "@/lib/client-import";
import type { Client } from "@/lib/clients";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, Loader2, MapPin, Phone, Mail } from "lucide-react";

export function ClientImportDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedClient[]>([]);
  const [created, setCreated] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ParsedClient | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const parsed = await parseClientsFile(file);
      if (!parsed.length) {
        toast.error("Aucun client détecté dans ce fichier.");
      } else {
        toast.success(`${parsed.length} fiche(s) pré-chargée(s) — validez chaque création.`);
      }
      setRows(parsed);
      setCreated(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de lire le fichier");
    } finally {
      setLoading(false);
    }
  };

  const onCreated = (row: ParsedClient, _c: Client) => {
    setCreated((s) => new Set(s).add(row._row));
    setEditing(null);
  };

  const reset = () => {
    setRows([]);
    setCreated(new Set());
    setEditing(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Importer des clients (Excel)</DialogTitle>
            <DialogDescription>
              Chargez un fichier Excel (.xlsx) ou CSV. Chaque fiche est pré-remplie&nbsp;;
              vous validez manuellement chaque création pour la rendre visible.
            </DialogDescription>
          </DialogHeader>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          {rows.length === 0 ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-12 text-center transition-colors hover:border-primary/40 hover:bg-accent/10"
            >
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              )}
              <div>
                <p className="font-medium">Choisir un fichier</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Colonnes reconnues&nbsp;: Nom, Civilité, Adresse, Téléphone, Email, Contrat, Fréquence, Notes
                </p>
              </div>
            </button>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{created.size}/{rows.length} fiche(s) créée(s)</span>
                <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1.5 h-4 w-4" />Autre fichier
                </Button>
              </div>
              {rows.map((row) => {
                const done = created.has(row._row);
                return (
                  <Card key={row._row} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">
                          {row.civility ? `${row.civility} ` : ""}{row.name || "(sans nom)"}
                        </p>
                        {row.contract_type && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">{row.contract_type}</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {row.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{row.address}</span>}
                        {row.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{row.phone}</span>}
                        {row.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{row.email}</span>}
                      </div>
                    </div>
                    {done ? (
                      <Badge className="shrink-0 gap-1 bg-emerald-100 text-emerald-800">
                        <Check className="h-3 w-3" />Créée
                      </Badge>
                    ) : (
                      <Button size="sm" className="shrink-0" onClick={() => setEditing(row)}>
                        Vérifier et créer
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {editing && (
        <ClientForm
          key={editing._row}
          initial={editing}
          open
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          trigger={<span className="hidden" />}
          onSaved={(c) => onCreated(editing, c)}
        />
      )}
    </>
  );
}
