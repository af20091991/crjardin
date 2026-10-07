// Personnalisation totale du tableau de bord : titre et réglages de la page,
// ordre, visibilité, épinglage, largeur, hauteur des graphiques et titre de
// chaque bloc, ajout de graphiques du catalogue. Aucune incidence sur les
// calculs ni sur les données.
import { useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  LayoutGrid,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BLOCK_HEIGHTS,
  BLOCK_SIZES,
  PAGE_DENSITIES,
  chartHeight,
  densityGap,
  sizeClass,
  type BlockHeight,
  type BlockSize,
  type DashboardBlockDef,
  type DashboardLayout,
  type PageDensity,
} from "@/lib/pilot-dashboard-layout";
import {
  DASHBOARD_WIDGETS,
  WIDGET_GROUPS,
  extraLabel,
  makeExtraId,
  parseExtraId,
} from "@/lib/pilot-dashboard-widgets";

export function DashboardCustomizer({
  defs,
  layout,
}: {
  defs: DashboardBlockDef[];
  layout: DashboardLayout;
}) {
  const defaultLabel = (id: string) => defs.find((d) => d.id === id)?.label ?? extraLabel(id) ?? id;
  const labelOf = (id: string) => layout.titleOf(id, defaultLabel(id));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <LayoutGrid className="h-4 w-4" /> Personnaliser
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 p-4 pr-10">
          <SheetTitle className="font-serif">Personnaliser la page</SheetTitle>
          <SheetDescription>
            Tout est modifiable : titre, ordre, largeur, hauteur des graphiques et graphiques
            affichés. Vos choix sont conservés sur cet appareil et ne changent aucun chiffre.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 p-4">
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Page</h4>
              <div className="space-y-1">
                <Label htmlFor="dash-title" className="text-xs text-muted-foreground">
                  Titre
                </Label>
                <Input
                  id="dash-title"
                  value={layout.page.title}
                  placeholder="Dashboard"
                  maxLength={80}
                  onChange={(e) => layout.setPage({ title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dash-subtitle" className="text-xs text-muted-foreground">
                  Sous-titre
                </Label>
                <Input
                  id="dash-subtitle"
                  value={layout.page.subtitle}
                  placeholder="Pilot Pro · date du jour"
                  maxLength={80}
                  onChange={(e) => layout.setPage({ subtitle: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="dash-health" className="text-sm">
                  Barre d'état des données
                </Label>
                <Switch
                  id="dash-health"
                  checked={layout.page.showHealth}
                  onCheckedChange={(checked) => layout.setPage({ showHealth: checked })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm">Espacement</Label>
                <Select
                  value={layout.page.density}
                  onValueChange={(value) => layout.setPage({ density: value as PageDensity })}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_DENSITIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Blocs de la page</h4>
              <p className="text-xs text-muted-foreground">
                Glissez pour réordonner. Ouvrez un bloc pour le renommer, changer sa largeur ou la
                hauteur de ses graphiques.
              </p>
              <ul className="space-y-1">
                {layout.ordered.map((id, i) => {
                  const extra = parseExtraId(id) != null;
                  const open = openId === id;
                  return (
                    <li
                      key={id}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex != null) layout.reorder(dragIndex, i);
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      className={cn(
                        "rounded-md border border-border/60",
                        dragIndex === i && "opacity-50",
                      )}
                    >
                      <div className="flex items-center gap-1 px-2 py-1">
                        <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-1 text-left"
                          aria-expanded={open}
                          onClick={() => setOpenId(open ? null : id)}
                        >
                          {open ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-xs",
                              layout.isHidden(id) && "text-muted-foreground line-through",
                            )}
                          >
                            {labelOf(id)}
                          </span>
                        </button>
                        <IconBtn
                          title="Monter"
                          onClick={() => layout.move(id, -1)}
                          disabled={i === 0}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          title="Descendre"
                          onClick={() => layout.move(id, 1)}
                          disabled={i === layout.ordered.length - 1}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          title={layout.isPinned(id) ? "Détacher" : "Épingler en haut"}
                          onClick={() => layout.togglePinned(id)}
                        >
                          {layout.isPinned(id) ? (
                            <PinOff className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Pin className="h-3.5 w-3.5" />
                          )}
                        </IconBtn>
                        <IconBtn
                          title={layout.isHidden(id) ? "Afficher" : "Masquer"}
                          onClick={() => layout.toggleHidden(id)}
                        >
                          {layout.isHidden(id) ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </IconBtn>
                      </div>
                      {open && (
                        <div className="space-y-2 border-t border-border/60 bg-muted/20 p-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Titre du bloc</Label>
                            <Input
                              className="h-8"
                              value={layout.hasCustomTitle(id) ? labelOf(id) : ""}
                              placeholder={defaultLabel(id)}
                              maxLength={80}
                              onChange={(e) => layout.setTitle(id, e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Largeur</Label>
                              <Select
                                value={layout.sizeOf(id)}
                                onValueChange={(value) => layout.setSize(id, value as BlockSize)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {BLOCK_SIZES.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Graphiques</Label>
                              <Select
                                value={layout.heightOf(id)}
                                onValueChange={(value) =>
                                  layout.setHeight(id, value as BlockHeight)
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {BLOCK_HEIGHTS.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {extra && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full gap-2 text-destructive"
                              onClick={() => {
                                layout.removeExtra(id);
                                setOpenId(null);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Retirer ce graphique
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">
                Ajouter un graphique ({DASHBOARD_WIDGETS.length} au choix)
              </h4>
              {WIDGET_GROUPS.map((group) => (
                <div key={group} className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  <ul className="space-y-1">
                    {DASHBOARD_WIDGETS.filter((widget) => widget.group === group).map((widget) => {
                      const count = layout.extras.filter(
                        (id) => parseExtraId(id)?.widgetId === widget.id,
                      ).length;
                      return (
                        <li
                          key={widget.id}
                          className="flex items-start gap-2 rounded-md border border-border/60 px-2 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium">
                              {widget.label}
                              {count > 0 && (
                                <span className="ml-1 font-normal text-muted-foreground">
                                  · ajouté{count > 1 ? ` ×${count}` : ""}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {widget.description}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 shrink-0 gap-1 px-2 text-xs"
                            onClick={() => {
                              const id = makeExtraId(widget.id, layout.extras);
                              layout.addExtra(id);
                              setOpenId(null);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" /> Ajouter
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          </div>
        </ScrollArea>
        <div className="border-t border-border/60 p-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full gap-2"
            onClick={layout.reset}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Tout réinitialiser
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/**
 * Conteneur d'un bloc : applique l'ordre, la largeur et la hauteur des
 * graphiques choisis, et masque le bloc si demandé.
 */
export function DashboardBlock({
  id,
  layout,
  children,
}: {
  id: string;
  layout: DashboardLayout;
  children: ReactNode;
}) {
  if (layout.isHidden(id)) return null;
  const height = chartHeight(layout.heightOf(id));
  const style = {
    order: layout.indexOf(id),
    ...(height ? { "--chart-h": height } : {}),
  } as CSSProperties;
  return (
    <div style={style} className={cn("min-w-0 space-y-2", sizeClass(layout.sizeOf(id)))}>
      {children}
    </div>
  );
}

/**
 * Conteneur d'une page organisée en blocs indépendants : l'ordre, la largeur
 * et l'espacement choisis par l'utilisateur sont appliqués en CSS (grille de
 * 12 colonnes + order), sans toucher aux données.
 */
export function PageBlocks({
  children,
  className,
  density = "normal",
}: {
  children: ReactNode;
  className?: string;
  density?: PageDensity;
}) {
  return <div className={cn("grid grid-cols-12", densityGap(density), className)}>{children}</div>;
}
