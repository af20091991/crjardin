import type { ADPPActionProposal } from './adpp-capabilities';

export interface ADPPActionViewModel extends ADPPActionProposal {
  primaryLabel: string;
  secondaryLabel: string;
  explanation: string;
}

export function toADPPActionViewModel(action: ADPPActionProposal): ADPPActionViewModel {
  if (action.risk === 'blocked') {
    return {
      ...action,
      primaryLabel: 'Comprendre pourquoi',
      secondaryLabel: 'Fermer',
      explanation: 'ADPP ne peut pas exécuter cette action automatiquement.',
    };
  }

  if (action.requiresConfirmation) {
    return {
      ...action,
      primaryLabel: 'Valider',
      secondaryLabel: 'Annuler',
      explanation: action.businessLogicTouched
        ? 'Cette action touche une règle métier sensible et nécessite votre validation.'
        : 'ADPP a préparé cette action. Rien ne sera modifié sans votre accord.',
    };
  }

  return {
    ...action,
    primaryLabel: 'Voir le résultat',
    secondaryLabel: 'Fermer',
    explanation: 'Cette action est informative et ne modifie pas Pilot Pro.',
  };
}
