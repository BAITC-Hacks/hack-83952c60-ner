import type { DistrictId } from '../engine/types';

export type AuditAction = 'schools' | 'hub';
export interface AuditState {
  /** Local preview budget, in billion KZT; independent of the city simulation. */
  remainingBudget: number;
  built: Partial<Record<DistrictId, Partial<Record<AuditAction, boolean>>>>;
}
export interface AuditFlow {
  kind: 'schools' | 'work' | 'services';
  target: DistrictId;
  count: number | null;
  label: string;
  /** Share of the original flow left after the preview intervention (0–1). */
  remaining: number;
}
export interface DistrictAudit {
  schoolDeficit: number;
  nearbyJobs: number;
  serviceAccess: number;
  /** Percentage points subtracted from the map's original load. */
  loadReduction: number;
  bridgeReduction: number;
  flows: AuditFlow[];
}

export const AUDIT_ACTIONS = {
  schools: { cost: 15, label: '2 школы шаговой доступности' },
  hub: { cost: 5, label: 'Сервисный хаб / АЗС на окраине' },
} as const;

interface AuditProfile {
  schoolDeficit: number;
  nearbyJobs: number;
  serviceAccess: number;
  schoolLoadReduction: number;
  hubLoadReduction: number;
  schoolBridgeReduction: number;
  hubBridgeReduction: number;
  flows: Omit<AuditFlow, 'remaining'>[];
}

// Illustrative local what-if data, not measured commuting statistics or forecasts.
// These previews deliberately do not mutate the persistent digital-twin model.
export const AUDIT_PROFILES: Record<DistrictId, AuditProfile> = {
  nura: {
    schoolDeficit: 65, nearbyJobs: 22, serviceAccess: 40,
    schoolLoadReduction: 34, hubLoadReduction: 12,
    schoolBridgeReduction: 24, hubBridgeReduction: 8,
    flows: [
      { kind: 'schools', target: 'saryarka', count: 12_400, label: 'детей → старые гимназии' },
      { kind: 'work', target: 'esil', count: 45_000, label: 'сотрудников → Дом министерств / БЦ' },
      { kind: 'services', target: 'baikonur', count: null, label: 'Выезд за СТО и оптовыми складами' },
    ],
  },
  esil: {
    schoolDeficit: 48, nearbyJobs: 72, serviceAccess: 45,
    schoolLoadReduction: 24, hubLoadReduction: 10,
    schoolBridgeReduction: 17, hubBridgeReduction: 7,
    flows: [
      { kind: 'schools', target: 'saryarka', count: 8_600, label: 'детей → старые гимназии' },
      { kind: 'work', target: 'almaty', count: 15_000, label: 'сотрудников → офисы и торговые центры' },
      { kind: 'services', target: 'baikonur', count: null, label: 'Выезд за СТО и оптовыми складами' },
    ],
  },
  almaty: {
    schoolDeficit: 42, nearbyJobs: 55, serviceAccess: 62,
    schoolLoadReduction: 21, hubLoadReduction: 8,
    schoolBridgeReduction: 14, hubBridgeReduction: 5,
    flows: [
      { kind: 'schools', target: 'saryarka', count: 7_200, label: 'детей → старые гимназии' },
      { kind: 'work', target: 'esil', count: 28_000, label: 'сотрудников → Дом министерств / БЦ' },
      { kind: 'services', target: 'baikonur', count: null, label: 'Выезд за СТО и оптовыми складами' },
    ],
  },
  saryarka: {
    schoolDeficit: 28, nearbyJobs: 58, serviceAccess: 68,
    schoolLoadReduction: 15, hubLoadReduction: 6,
    schoolBridgeReduction: 10, hubBridgeReduction: 4,
    flows: [
      { kind: 'schools', target: 'almaty', count: 3_800, label: 'детей → школы соседнего района' },
      { kind: 'work', target: 'esil', count: 26_000, label: 'сотрудников → Дом министерств / БЦ' },
      { kind: 'services', target: 'baikonur', count: null, label: 'Выезд за СТО и оптовыми складами' },
    ],
  },
  baikonur: {
    schoolDeficit: 38, nearbyJobs: 47, serviceAccess: 76,
    schoolLoadReduction: 19, hubLoadReduction: 5,
    schoolBridgeReduction: 13, hubBridgeReduction: 3,
    flows: [
      { kind: 'schools', target: 'saryarka', count: 5_900, label: 'детей → старые гимназии' },
      { kind: 'work', target: 'esil', count: 24_000, label: 'сотрудников → Дом министерств / БЦ' },
      { kind: 'services', target: 'almaty', count: null, label: 'Выезд за специализированными сервисами' },
    ],
  },
  saraishyk: {
    schoolDeficit: 60, nearbyJobs: 30, serviceAccess: 35,
    schoolLoadReduction: 30, hubLoadReduction: 13,
    schoolBridgeReduction: 21, hubBridgeReduction: 9,
    flows: [
      { kind: 'schools', target: 'almaty', count: 10_200, label: 'детей → школы соседнего района' },
      { kind: 'work', target: 'esil', count: 32_000, label: 'сотрудников → Дом министерств / БЦ' },
      { kind: 'services', target: 'baikonur', count: null, label: 'Выезд за СТО и оптовыми складами' },
    ],
  },
};

export function initialAuditState(): AuditState {
  return { remainingBudget: 60, built: {} };
}

export function applyAuditAction(state: AuditState, district: DistrictId, action: AuditAction): AuditState {
  const cost = AUDIT_ACTIONS[action].cost;
  if (state.built[district]?.[action] || state.remainingBudget < cost) return state;
  return {
    remainingBudget: state.remainingBudget - cost,
    built: { ...state.built, [district]: { ...state.built[district], [action]: true } },
  };
}

export function auditDistrict(id: DistrictId, state: AuditState): DistrictAudit {
  const profile = AUDIT_PROFILES[id];
  const schools = !!state.built[id]?.schools;
  const hub = !!state.built[id]?.hub;
  return {
    schoolDeficit: Math.max(0, profile.schoolDeficit - (schools ? 40 : 0)),
    nearbyJobs: profile.nearbyJobs,
    serviceAccess: Math.min(100, profile.serviceAccess + (hub ? 40 : 0)),
    loadReduction: (schools ? profile.schoolLoadReduction : 0) + (hub ? profile.hubLoadReduction : 0),
    bridgeReduction: (schools ? profile.schoolBridgeReduction : 0) + (hub ? profile.hubBridgeReduction : 0),
    flows: profile.flows.map(flow => ({
      ...flow,
      remaining: flow.kind === 'schools' && schools ? 0.35 : flow.kind === 'services' && hub ? 0.3 : 1,
    })),
  };
}
