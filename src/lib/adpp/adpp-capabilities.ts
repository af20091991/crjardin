export type ADPPCapability =
  | 'direction'
  | 'data'
  | 'calculation'
  | 'research'
  | 'improve_pp';

export type ADPPActionRisk = 'safe' | 'review_required' | 'blocked';

export interface ADPPActionProposal {
  capability: ADPPCapability;
  title: string;
  summary: string;
  risk: ADPPActionRisk;
  businessLogicTouched: boolean;
  requiresConfirmation: boolean;
  reversible: boolean;
}

export const ADPP_SYSTEM_RULES = [
  'Répondre en français par défaut.',
  'Ne jamais inventer une donnée PP absente ou non vérifiée.',
  'Séparer clairement les données observées, les calculs et les recommandations.',
  'Les calculs métier doivent utiliser les données PP disponibles et expliciter leurs hypothèses.',
  'Aucune écriture métier silencieuse.',
  'Toute modification du code doit être proposée puis validée explicitement.',
  'Ne jamais exposer de jargon technique à l’utilisateur sauf demande explicite.',
  'Protéger les secrets, les workflows et les branches principales.',
] as const;

export function classifyADPPAction(input: {
  capability: ADPPCapability;
  modifiesBusinessData?: boolean;
  modifiesCode?: boolean;
  touchesSensitiveBusinessLogic?: boolean;
}): ADPPActionProposal {
  const modifiesBusinessData = Boolean(input.modifiesBusinessData);
  const modifiesCode = Boolean(input.modifiesCode);
  const touchesSensitive = Boolean(input.touchesSensitiveBusinessLogic);

  if (touchesSensitive) {
    return {
      capability: input.capability,
      title: 'Validation renforcée nécessaire',
      summary: 'Cette action peut modifier une règle métier sensible de Pilot Pro.',
      risk: 'review_required',
      businessLogicTouched: true,
      requiresConfirmation: true,
      reversible: false,
    };
  }

  if (modifiesBusinessData || modifiesCode) {
    return {
      capability: input.capability,
      title: 'Modification prête à valider',
      summary: modifiesCode
        ? 'Une modification technique a été préparée et doit être contrôlée avant application.'
        : 'Une modification des données a été préparée et doit être confirmée avant application.',
      risk: 'review_required',
      businessLogicTouched: false,
      requiresConfirmation: true,
      reversible: true,
    };
  }

  return {
    capability: input.capability,
    title: 'Analyse prête',
    summary: 'Cette action ne modifie aucune donnée ni aucun code.',
    risk: 'safe',
    businessLogicTouched: false,
    requiresConfirmation: false,
    reversible: true,
  };
}
