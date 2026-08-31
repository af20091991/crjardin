import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Search,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ClientDirectoryRow {
  id: string;
  name: string;
  civility?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  statusLabel: string;
  statusClassName: string;
  activityLabel: string;
  contractType?: string | null;
  caLabel?: string;
  hourlyLabel?: string;
  lastActivityLabel?: string;
  isFavorite: boolean;
}

interface ClientDirectoryViewProps {
  rows: ClientDirectoryRow[];
  search: string;
  onSearchChange: (value: string) => void;
  onToggleFavorite: (id: string) => void;
  canEdit: boolean;
}

export function ClientDirectoryView({
  rows,
  search,
  onSearchChange,
  onToggleFavorite,
  canEdit,
}: ClientDirectoryViewProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2 shadow-sm">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Rechercher un client, une adresse, un contact…"
          className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {rows.length} client{rows.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-background md:block">
        <div className="grid grid-cols-[minmax(260px,2fr)_minmax(160px,1fr)_minmax(150px,1fr)_auto] items-center border-b bg-muted/20 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          <span>Client</span>
          <span>Activité</span>
          <span>Valeur</span>
          <span />
        </div>
        <div className="divide-y">
          {rows.map((row) => (
            <DirectoryRow
              key={row.id}
              row={row}
              onToggleFavorite={onToggleFavorite}
              canEdit={canEdit}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-2 md:hidden">
        {rows.map((row) => (
          <MobileDirectoryRow
            key={row.id}
            row={row}
            onToggleFavorite={onToggleFavorite}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}

function DirectoryRow({
  row,
  onToggleFavorite,
  canEdit,
}: {
  row: ClientDirectoryRow;
  onToggleFavorite: (id: string) => void;
  canEdit: boolean;
}) {
  return (
    <div className="group grid grid-cols-[minmax(260px,2fr)_minmax(160px,1fr)_minmax(150px,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label={
            row.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"
          }
          onClick={() => onToggleFavorite(row.id)}
          className="rounded-md p-1 text-muted-foreground hover:text-amber-500"
        >
          <Star
            className={cn(
              "h-4 w-4",
              row.isFavorite && "fill-amber-400 text-amber-500",
            )}
          />
        </button>
        <div className="min-w-0">
          <Link
            to={canEdit ? "/pilot/fiche/$clientId" : "/clients/$clientId"}
            params={{ clientId: row.id }}
            className="block truncate text-sm font-medium hover:text-primary"
          >
            {row.civility ? (
              <span className="text-muted-foreground">{row.civility} </span>
            ) : null}
            {row.name}
          </Link>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <Badge
              variant="outline"
              className={cn("h-5 px-1.5 text-[10px]", row.statusClassName)}
            >
              {row.statusLabel}
            </Badge>
            {row.contractType && <span>{row.contractType}</span>}
          </div>
        </div>
      </div>

      <div className="min-w-0 text-xs text-muted-foreground">
        <span className="block truncate text-foreground/80">
          {row.activityLabel}
        </span>
        {row.lastActivityLabel && <span>{row.lastActivityLabel}</span>}
      </div>

      <div className="text-xs">
        <span className="block font-medium">{row.caLabel ?? "—"}</span>
        {row.hourlyLabel && (
          <span className="text-muted-foreground">{row.hourlyLabel}</span>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to="/clients/$clientId" params={{ clientId: row.id }}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function MobileDirectoryRow({
  row,
  onToggleFavorite,
  canEdit,
}: {
  row: ClientDirectoryRow;
  onToggleFavorite: (id: string) => void;
  canEdit: boolean;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={
            row.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"
          }
          onClick={() => onToggleFavorite(row.id)}
          className="mt-0.5 rounded-md p-1 text-muted-foreground hover:text-amber-500"
        >
          <Star
            className={cn(
              "h-4 w-4",
              row.isFavorite && "fill-amber-400 text-amber-500",
            )}
          />
        </button>
        <div className="min-w-0 flex-1">
          <Link
            to={canEdit ? "/pilot/fiche/$clientId" : "/clients/$clientId"}
            params={{ clientId: row.id }}
            className="block truncate text-sm font-medium"
          >
            {row.civility ? `${row.civility} ` : ""}
            {row.name}
          </Link>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className={cn("h-5 px-1.5 text-[10px]", row.statusClassName)}
            >
              {row.statusLabel}
            </Badge>
            {row.contractType && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {row.contractType}
              </Badge>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Activité</span>
              <p>{row.activityLabel}</p>
            </div>
            <div>
              <span className="text-muted-foreground">CA</span>
              <p>{row.caLabel ?? "—"}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-muted-foreground">
            {row.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {row.email}
              </span>
            )}
            {row.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {row.phone}
              </span>
            )}
            {row.address && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {row.address}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to="/clients/$clientId" params={{ clientId: row.id }}>
            <MoreHorizontal className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
