import type { ADPPActionProposal } from './adpp-capabilities';

export type ADPPActionSessionState = 'proposed' | 'confirmed' | 'cancelled' | 'blocked';

export interface ADPPActionSession {
  id: string;
  action: ADPPActionProposal;
  state: ADPPActionSessionState;
  createdAt: string;
  confirmedAt?: string;
}

export function createADPPActionSession(action: ADPPActionProposal, id = crypto.randomUUID()): ADPPActionSession {
  return {
    id,
    action,
    state: action.risk === 'blocked' ? 'blocked' : 'proposed',
    createdAt: new Date().toISOString(),
  };
}

export function confirmADPPActionSession(session: ADPPActionSession): ADPPActionSession {
  if (session.state !== 'proposed' || !session.action.requiresConfirmation) {
    return session;
  }

  return {
    ...session,
    state: 'confirmed',
    confirmedAt: new Date().toISOString(),
  };
}

export function cancelADPPActionSession(session: ADPPActionSession): ADPPActionSession {
  if (session.state !== 'proposed') return session;
  return { ...session, state: 'cancelled' };
}
