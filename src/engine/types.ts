// Domain types for Astana City Management AI Simulator

export type DistrictId = 'esil' | 'almaty' | 'saryarka' | 'baikonur' | 'nura';

export type DirectionId = 'transport' | 'ecology' | 'social' | 'safety' | 'services';

export type IndicatorId =
  | 'T1' | 'T2'
  | 'E1' | 'E2'
  | 'S1' | 'S2'
  | 'B1' | 'B2'
  | 'C1' | 'C2';

export interface DistrictInfo {
  id: DistrictId;
  nameRu: string;
  nameKz: string;
  nameEn: string;
  populationShare: number; // e.g. 0.27
  profileRu: string;
  profileKz: string;
  indicators: Record<IndicatorId, number>;
  baseDistrictScore: number;
}

export interface IndicatorMeta {
  id: IndicatorId;
  direction: DirectionId;
  nameRu: string;
  descriptionRu: string;
  meaningRu: string;
  weight: number;
}

export type MeasureType = 'Район' | 'Город';

export interface MeasureInfo {
  id: string; // 'M1' .. 'M14'
  direction: DirectionId;
  nameRu: string;
  type: MeasureType;
  cost: number;
  lag: number; // quarters, 1..4 (horizon H = 8)
  effects: Partial<Record<IndicatorId, number>>; // raw effect before lag
  descriptionRu?: string;
}

export interface SelectedDecision {
  measureId: string;
  districtId?: DistrictId; // required if measure.type === 'Район'
}

export interface SynergyRule {
  pair: [string, string];
  bonus: Partial<Record<IndicatorId, number>>;
  applyTo: 'first_district' | 'city';
  descriptionRu: string;
}

export interface IncompatibilityRule {
  pair: [string, string];
  scope: 'any_district' | 'same_district';
  reasonRu: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  totalCost: number;
  remainingBudget: number;
  decisionCount: number;
  directionCounts: Record<DirectionId, number>;
}

export interface DistrictSimulationResult {
  districtId: DistrictId;
  nameRu: string;
  populationShare: number;
  initialIndicators: Record<IndicatorId, number>;
  finalIndicators: Record<IndicatorId, number>;
  indicatorDeltas: Record<IndicatorId, number>;
  initialDistrictScore: number;
  finalDistrictScore: number;
  scoreDelta: number;
  criticalIndicators: IndicatorId[];
}

interface SimulationResultBase {
  validation: ValidationResult;
  decisions: SelectedDecision[];
  districts: Record<DistrictId, DistrictSimulationResult>;
  baseCityAverage: number;
  finalCityAverage: number;
  baseMinDistrictScore: number;
  finalMinDistrictScore: number;
  weakestDistrictId: DistrictId;
  baseCritCount: number;
  finalCritCount: number;
  criticalPairs: Array<{ districtId: DistrictId; indicatorId: IndicatorId; value: number }>;
  baseScore: number;
  activeSynergies: string[];
  appliedEvents?: CityEvent[];
}

export interface ValidSimulationResult extends SimulationResultBase {
  isValid: true;
  finalScore: number;
  scoreDelta: number;
}

export interface InvalidSimulationResult extends SimulationResultBase {
  isValid: false;
  finalScore: null;
  scoreDelta: null;
}

export type SimulationResult = ValidSimulationResult | InvalidSimulationResult;

export interface CityEvent {
  id: string;
  titleRu: string;
  descriptionRu: string;
  costImpact?: number;
  indicatorImpacts?: Partial<Record<DistrictId, Partial<Record<IndicatorId, number>>>>;
  cityWideImpacts?: Partial<Record<IndicatorId, number>>;
  severity: 'low' | 'medium' | 'high';
}

export interface AIAnalysis {
  executiveSummary: string;
  strengths: string[];
  risksAndTradeoffs: string[];
  districtHighlights: Array<{
    district: string;
    verdict: string;
    criticalWarning?: string;
  }>;
  actionableRecommendations: string[];
  akimatRatingVerdict: string;
}
