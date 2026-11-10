import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { AppVersionCard } from "@/components/AppVersionCard";
import { BiometricLockSetting } from "@/components/BiometricLockSetting";
import { BiometricLoginSetting } from "@/components/BiometricLoginSetting";
import { AppShell, NAV_GROUP_LABELS } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  useAppearance,
  PRIMARY_PRESETS,
  ACCENT_PRESETS,
  type ThemeMode,
  type Density,
  type Skin,
  type UiTheme,
  type FontChoice,
  type BorderWidth,
  type TextScale,
  type TableDensity,
  type ContentWidth,
  type NavIndicator,
  type AccentSaturation,
  type DarkTint,
  type WeekStart,
  type CardReading,
  type CardStyle,
  type VisualProfile,
  type ValueAlign,
  type LabelLevel,
  type EuroFormat,
  type HoursFormat,
  type PercentFormat,
  type SurfaceTone,
  type CardElevation,
  type SidebarWidth,
  type NavSpacing,
  type ActiveIndicator,
  CARD_STYLES,
  effectiveCardStyle,
  effectiveValueAlign,
  FONT_GROUPS,
  FONT_STACKS,
} from "@/lib/appearance";

import {
  Palette,
  Sun,
  Moon,
  Monitor,
  RotateCcw,
  Check,
  Sparkles,
  Type,
  Layers3,
  LayoutPanelLeft,
  PanelLeft,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/personnalisation")({
  head: () => ({ meta: [{ title: "Personnalisation — De la graine au jardin" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/personnalisation"),
    "PersonnalisationPage",
  ),
});
