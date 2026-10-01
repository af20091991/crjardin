import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PremiumSection } from "@/components/share/PremiumHome";

type NavEntry =
  | { id: PremiumSection; label: string }
  | { label: string; children: { id: PremiumSection; label: string }[] };

export const PREMIUM_NAV: NavEntry[] = [
  { id: "home", label: "Accueil" },
  { id: "garden", label: "Le jardin" },
  { id: "reports", label: "Les interventions" },
  { id: "photos", label: "Photos" },
  {
    label: "Documents",
    children: [
      { id: "documents", label: "Documents" },
      { id: "calendar", label: "Calendrier travaux" },
    ],
  },
  { id: "exchange", label: "Échanger" },
];

const itemClass = (active: boolean) =>
  `h-16 shrink-0 rounded-none border-b-2 px-0 text-base font-medium sm:h-[4.5rem] sm:text-lg hover:bg-transparent ${
    active
      ? "border-primary text-primary"
      : "border-transparent text-muted-foreground hover:text-foreground"
  }`;

function HoverMenu({
  label,
  children,
  section,
  onNavigate,
}: {
  label: string;
  children: { id: PremiumSection; label: string }[];
  section: PremiumSection;
  onNavigate: (section: PremiumSection) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const active = children.some((child) => child.id === section);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-current={active ? "page" : undefined}
          className={`${itemClass(active)} gap-1`}
          onPointerEnter={(event) => event.pointerType === "mouse" && show()}
          onPointerLeave={(event) => event.pointerType === "mouse" && hide()}
        >
          {label}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={0}
        onPointerEnter={show}
        onPointerLeave={hide}
        className="min-w-[13rem]"
      >
        {children.map((child) => (
          <DropdownMenuItem
            key={child.id}
            onSelect={() => onNavigate(child.id)}
            className={`cursor-pointer text-base ${section === child.id ? "text-primary" : ""}`}
          >
            {child.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PremiumNav({
  section,
  onNavigate,
  className = "",
}: {
  section: PremiumSection;
  onNavigate: (section: PremiumSection) => void;
  className?: string;
}) {
  return (
    <div
      className={`premium-carnet-nav sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur ${className}`}
    >
      <nav
        className="mx-auto flex w-full max-w-[1320px] items-center gap-6 overflow-x-auto px-5 sm:gap-10 sm:px-10 lg:px-16"
        aria-label="Navigation Premium"
      >
        {PREMIUM_NAV.map((entry) =>
          "children" in entry ? (
            <HoverMenu
              key={entry.label}
              label={entry.label}
              children={entry.children}
              section={section}
              onNavigate={onNavigate}
            />
          ) : (
            <Button
              key={entry.id}
              type="button"
              variant="ghost"
              onClick={() => onNavigate(entry.id)}
              aria-current={section === entry.id ? "page" : undefined}
              className={itemClass(section === entry.id)}
            >
              {entry.label}
            </Button>
          ),
        )}
      </nav>
    </div>
  );
}
