export type DirecteurMode = "direction" | "data" | "calculate" | "search" | "improve";

export type DirecteurActionKind = "navigate" | "simulate" | "draft" | "code_change";

export interface DirecteurAction {
  id: string;
  kind: DirecteurActionKind;
  label: string;
  description?: string;
  requiresConfirmation: boolean;
  payload?: Record<string, unknown>;
}

export interface DirecteurResponse {
  answer: string;
  model?: string;
  usedWebSearch?: boolean;
  usedCalculator?: boolean;
  actions?: DirecteurAction[];
  readOnly?: boolean;
}

export const DIRECTEUR_RULES = {
  neverSilentWrite: true,
  dataSourceMustBeExplicit: true,
  codeChangesRequireConfirmation: true,
  noTechnicalUiByDefault: true,
} as const;
