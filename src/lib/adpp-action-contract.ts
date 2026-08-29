export type ADPPActionKind =
  | "analysis"
  | "calculation"
  | "simulation"
  | "code_change"
  | "data_change";

export type ADPPActionStatus =
  | "proposed"
  | "validating"
  | "ready"
  | "awaiting_approval"
  | "applied"
  | "rejected"
  | "failed";

export interface ADPPActionProposal {
  id: string;
  kind: ADPPActionKind;
  title: string;
  summary: string;
  impact: string;
  status: ADPPActionStatus;
  requiresApproval: boolean;
  technicalDetails?: string;
  affectedFiles?: string[];
  checks?: Array<{ label: string; status: "ok" | "warning" | "failed" }>;
}

/**
 * ADPP never mutates business data or application code silently.
 * The UI should expose only the user-facing summary; technical details remain optional.
 */
export const requiresExplicitApproval = (action: ADPPActionProposal) =>
  action.kind === "code_change" || action.kind === "data_change";
