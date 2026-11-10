import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { AddressLink, PhoneActions } from "@/components/ContactActions";
import { LoadingState } from "@/components/pilot/LoadingState";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  BrickWall,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Eye,
  FileDown,
  Flower2,
  Leaf,
  Loader2,
  MountainSnow,
  Pencil,
  RotateCcw,
  Sparkles,
  Sprout,
  Settings2,
  Trash2,
  TreePine,
} from "lucide-react";
import { toast } from "sonner";
import { SstChangesPanel, useUnseenSstChanges } from "@/components/pilot/SstChangesPanel";
import { SstNotifyDialog } from "@/components/pilot/SstNotifyDialog";
import { unseenCountByDate } from "@/lib/sst-calendar-changes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { WorksiteSheetForm } from "@/components/WorksiteSheetForm";
import { SstWeatherStrip } from "@/components/pilot/SstWeatherStrip";
import logo from "@/assets/logo.png";
import {
  declareAvailability,
  getCurrentSstLabel,
  groupByDate,
  isoDate,
  isoWeekNumber,
  listAvailabilities,
  listRecentAvailabilities,
  monthGridDates,
  monthWindow,
  removeAvailability,
  updateAvailabilityComment,
  type SstAvailabilityWithUser,
} from "@/lib/calendrier-sst";
import { mirrorPrefToAccount, removePrefFromAccount } from "@/lib/account-prefs";
import {
  CALENDAR_STORAGE_KEY,
  DEFAULT_CALENDAR_FILTERS,
  DEFAULT_CALENDAR_PREFERENCES,
  addDaysIso,
  cornerClass,
  firstWeekOfMonth,
  isFilteringCalendar,
  matchesPersonFilter,
  mondayOfIso,
  parseIso,
  personKey,
  gapClass,
  heightClass,
  mergePreferences,
  splitDayItems,
  styleClass,
  toneClasses,
  weekDatesIso,
  type CalendarCorner,
  type CalendarFilters,
  type CalendarView,
  type CalendarDensity,
  type CalendarGap,
  type CalendarPreferences,
  type CalendarStyle,
  type CalendarTone,
} from "@/lib/calendrier-sst-display";
import {
  INTERVENANTS,
  getWorksiteSheet,
  listWorksiteSheets,
  updateWorksitePlanning,
  type WorksiteSheet,
} from "@/lib/worksite";
import { listClients } from "@/lib/clients";
import { getSstForecast } from "@/lib/meteo-sst.functions";
import {
  buildOpenMeteoUrl,
  parseOpenMeteo,
  referencePoint,
  type WeatherFields,
} from "@/lib/meteo-sst";
import { exportCompleteWorksiteSheetPdf } from "@/lib/worksite-pdf-complete";
import { parseWorksiteIntervenants } from "@/lib/worksite-sst";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pilot/calendrier")({
  head: () => ({
    meta: [
      { title: "Calendrier SST — De la graine au jardin" },
      { name: "description", content: "Calendrier partagé des disponibilités des utilisateurs." },
      { property: "og:title", content: "Calendrier SST" },
      {
        property: "og:description",
        content: "Calendrier partagé des disponibilités des utilisateurs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/pilot.calendrier"), "CalendrierSstPage"),
});
