import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import {
  getIntervention,
  updateIntervention,
  deleteIntervention,
  listTasks,
  addTask,
  updateTask,
  deleteTask,
  listPhotos,
  addPhoto,
  updatePhoto,
  deletePhoto,
  signedPhotoUrl,
  reorderPhotos,
  TASK_STATUS_META,
  type TaskStatus,
  type InterventionPhoto,
  type Intervention,
  DEFAULT_REPORT_SECTIONS,
  REPORT_SECTION_LABELS,
  SELECTABLE_REPORT_SECTIONS,
  normalizeReportSections,
  type ReportSections,
  listServiceCatalog,
  completeInterventionWithHoursAutofill,
} from "@/lib/interventions";
import {
  listHealthByClient,
  addHealth,
  deleteHealth,
  HEALTH_RATINGS,
  HEALTH_RATING_META,
  type HealthRating,
  listRecommendationsByClient,
  addRecommendation,
  updateRecommendation,
  deleteRecommendation,
  RECO_STATUSES,
  RECO_STATUS_META,
  type RecommendationStatus,
  recommendationPrice,
  formatEuro,
  RECO_PRIORITIES,
  RECO_PRIORITY_META,
  type RecommendationPriority,
  RECO_SEASONS,
  RECO_SEASON_LABELS,
  type RecommendationSeason,
} from "@/lib/garden";
import { generateInterventionInsights, analyzeInterventionPhotos } from "@/lib/ai.functions";
import { getClient, clientEmails, listClients } from "@/lib/clients";
import {
  canSendReport,
  REPORT_SEND_LABELS,
  reportSendBlocker,
  reportSendStatus,
  resumeReportLogging,
  reportShareUrl,
  sendOutcomeMessage,
  sendReportToRecipients,
  type ReportSendContext,
  type SendOutcome,
} from "@/lib/report-send";
import { getMyProfile } from "@/lib/profile";
import { InterventionMessages } from "@/components/InterventionMessages";
import { uploadInterventionPhoto } from "@/lib/storage";
import { exportInterventionPdf } from "@/lib/intervention-pdf";
import {
  archiveInterventionReport,
  listReportHistory,
  signedReportUrl,
  logReportEvent,
  REPORT_EVENT_LABEL,
  withVersions,
} from "@/lib/report-history";
import { getWorksiteSheet } from "@/lib/worksite";
import { InterventionReportPreview } from "@/components/InterventionReportPreview";
import { sendTransactionalEmail } from "@/lib/email/send";
import { getEmailSettings, fillTemplate } from "@/lib/email-settings";
import { ImageLightbox } from "@/components/ImageLightbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  ImagePlus,
  CheckCircle2,
  X,
  Sparkles,
  Leaf,
  Lightbulb,
  FileDown,
  ScanSearch,
  Check,
  Mail,
  Archive,
  Eye,
  History,
  Download,
  ArrowUp,
  ArrowDown,
  Settings2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/interventions/$interventionId")({
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/interventions.$interventionId"), "InterventionDetail"),
});
