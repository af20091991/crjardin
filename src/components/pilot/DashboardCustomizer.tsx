// Personal layout only; no business data is changed.
import { Children, isValidElement, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  LayoutGrid,
  Pin,
  PinOff,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockWidth, DashboardBlockDef, DashboardLayout } from "@/lib/pilot-dashboard-layout";

function WidthSelect({
  id,
  label,
  layout,
}: {
  id: string;
  label: string;
  layout: DashboardLayout;
}) {
  return (
    <Select
      value={layout.width(id)}
      onValueChange={(value) => layout.setWidth(id, value as BlockWidth)}
    >
      <SelectTrigger className="h-7 w-28 shrink-0 text-xs" aria-label={`Largeur de ${label}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="full">Pleine largeur</SelectItem>
        <SelectItem value="half">Demi-largeur</SelectItem>
        <SelectItem value="third">Un tiers</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function DashboardCustomizer({
  defs,
  layout,
}: {
  defs: DashboardBlockDef[];
  layout: DashboardLayout;
}) {
  const labelOf = (id: string) => defs.find((d) => d.id === id)?.label ?? id;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={layout.editing ? "default" : "outline"}
        size="sm"
        className="gap-2"
        onClick={() => layout.setEditing(!layout.editing)}
      >
        {layout.editing ? <Check className="h-4 w-4" /> : <GripVertical className="h-4 w-4" />}
        {layout.editing ? "Terminer" : "Réagencer"}
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <LayoutGrid className="h-4 w-4" /> Personnaliser
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(420px,calc(100vw-2rem))] space-y-3">
          <ul className="space-y-2">
            {layout.ordered.map((id, i) => (
              <li
                key={id}
                className="flex flex-wrap items-center gap-1 border-b border-border pb-2"
              >
                <span
                  className={cn(
                    "min-w-0 flex-1 text-sm",
                    layout.isHidden(id) && "text-muted-foreground line-through",
                  )}
                >
                  {labelOf(id)}
                </span>
                <IconBtn
                  title={`Monter ${labelOf(id)}`}
                  onClick={() => layout.move(id, -1)}
                  disabled={i === 0}
                >
                  <ArrowUp className="h-4 w-4" />
                </IconBtn>
                <IconBtn
                  title={`Descendre ${labelOf(id)}`}
                  onClick={() => layout.move(id, 1)}
                  disabled={i === layout.ordered.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </IconBtn>
                <IconBtn
                  title={
                    layout.isPinned(id) ? `Détacher ${labelOf(id)}` : `Épingler ${labelOf(id)}`
                  }
                  onClick={() => layout.togglePinned(id)}
                >
                  {layout.isPinned(id) ? (
                    <PinOff className="h-4 w-4 text-primary" />
                  ) : (
                    <Pin className="h-4 w-4" />
                  )}
                </IconBtn>
                <IconBtn
                  title={layout.isHidden(id) ? `Afficher ${labelOf(id)}` : `Masquer ${labelOf(id)}`}
                  onClick={() => layout.toggleHidden(id)}
                >
                  {layout.isHidden(id) ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </IconBtn>
                <div className="basis-full">
                  <WidthSelect id={id} label={labelOf(id)} layout={layout} />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" disabled={!layout.canUndo} onClick={layout.undo}>
              <Undo2 className="mr-2 h-4 w-4" /> Annuler
            </Button>
            <Button variant="ghost" size="sm" onClick={layout.reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
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
      className="h-8 w-8 shrink-0"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

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
  return (
    <SortableBlock id={id} layout={layout}>
      {children}
    </SortableBlock>
  );
}

function SortableBlock({
  id,
  layout,
  children,
}: {
  id: string;
  layout: DashboardLayout;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !layout.editing });
  const width = layout.width(id);
  return (
    <div
      ref={setNodeRef}
      data-layout-block={id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "layout-block min-w-0 space-y-2 self-start col-span-6",
        width === "half" && "xl:col-span-3",
        width === "third" && "xl:col-span-2",
        layout.editing && "rounded-md outline outline-1 outline-primary/30",
        isDragging && "z-20 opacity-70",
      )}
    >
      {layout.editing && (
        <div className="flex flex-wrap items-center gap-1 bg-muted px-2 py-1">
          <Button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 touch-none cursor-grab active:cursor-grabbing"
            aria-label={`Déplacer ${id}`}
            title="Déplacer"
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <WidthSelect id={id} label={id} layout={layout} />
          <IconBtn title={`Masquer ${id}`} onClick={() => layout.toggleHidden(id)}>
            <EyeOff className="h-4 w-4" />
          </IconBtn>
        </div>
      )}
      {children}
    </div>
  );
}

export function PageBlocks({ children, className }: { children: ReactNode; className?: string }) {
  const nodes = Children.toArray(children);
  const blocks = nodes.filter(
    (child) =>
      isValidElement<{ id?: string; layout?: DashboardLayout }>(child) &&
      child.type === DashboardBlock,
  );
  const first = blocks[0];
  const layout = isValidElement<{ layout?: DashboardLayout }>(first)
    ? first.props.layout
    : undefined;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const sorted = [...blocks].sort((a, b) => {
    const idOf = (node: ReactNode) => (isValidElement<{ id: string }>(node) ? node.props.id : "");
    return (layout?.indexOf(idOf(a)) ?? 0) - (layout?.indexOf(idOf(b)) ?? 0);
  });
  const others = nodes.filter((node) => !blocks.includes(node));
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (layout && over && active.id !== over.id)
          layout.reorder(layout.indexOf(String(active.id)), layout.indexOf(String(over.id)));
      }}
    >
      <SortableContext
        items={layout?.ordered.filter((id) => !layout.isHidden(id)) ?? []}
        strategy={rectSortingStrategy}
      >
        <div className={cn("grid grid-cols-6 gap-4", className)}>
          {sorted}
          {others.map((node, index) => (
            <div key={index} className="col-span-6 min-w-0">
              {node}
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
