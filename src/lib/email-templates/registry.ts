import type { ComponentType } from "react";

export interface TemplateEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous template registry
  component: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous template data
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous template data
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
import { template as newReportTemplate } from "./new-report";
import { template as clientActivityTemplate } from "./client-activity";
import { template as sstPlanningTemplate } from "./sst-planning";
import { template as apReminderTemplate } from "./ap-reminder";
import { template as sstWorksiteSheetTemplate } from "./sst-worksite-sheet";

export const TEMPLATES: Record<string, TemplateEntry> = {
  "new-report": newReportTemplate,
  "client-activity": clientActivityTemplate,
  "sst-planning": sstPlanningTemplate,
  "ap-reminder": apReminderTemplate,
  "sst-worksite-sheet": sstWorksiteSheetTemplate,
};
