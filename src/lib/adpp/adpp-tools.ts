export type ADPPToolName =
  | 'pilot_read'
  | 'pilot_calculate'
  | 'pilot_simulate'
  | 'pilot_search'
  | 'code_propose';

export interface ADPPToolDefinition {
  name: ADPPToolName;
  label: string;
  readOnly: boolean;
  requiresConfirmation: boolean;
}

export const ADPP_TOOLS: readonly ADPPToolDefinition[] = [
  { name: 'pilot_read', label: 'Lire les données PP', readOnly: true, requiresConfirmation: false },
  { name: 'pilot_calculate', label: 'Calculer', readOnly: true, requiresConfirmation: false },
  { name: 'pilot_simulate', label: 'Simuler', readOnly: true, requiresConfirmation: false },
  { name: 'pilot_search', label: 'Rechercher', readOnly: true, requiresConfirmation: false },
  { name: 'code_propose', label: 'Préparer une amélioration de PP', readOnly: true, requiresConfirmation: true },
];

export function getADPPTool(name: ADPPToolName): ADPPToolDefinition {
  return ADPP_TOOLS.find((tool) => tool.name === name) ?? ADPP_TOOLS[0];
}
