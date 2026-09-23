/** JSON-only contracts shared by the browser simulation and the Node voice service. */
export type { DistrictId } from '../engine/types';
import type { DistrictId } from '../engine/types';

export type TravelPurpose = 'work' | 'school' | 'market' | 'leisure';
export type TransportMode = 'car' | 'bus' | 'school';
export type DecisionTopic = 'schools' | 'transport' | 'heating' | 'gas' | 'services' | 'leisure';
export type Point = readonly [number, number];

export interface DistrictAggregate {
  id: DistrictId;
  name: string;
  population: number;
  profile: string;
  /** Normalized schematic coordinates; not cadastral boundaries or GIS data. */
  centroid: Point;
  bank: 'left' | 'right';
  schoolDemand: number;
  schoolPlaces: number;
  kindergartenDemand: number;
  kindergartenPlaces: number;
  heatSupplyC: number;
  heatTargetC: number;
  income: 'low' | 'middle' | 'high';
}

export interface BridgeDefinition {
  id: string;
  name: string;
  left: Point;
  right: Point;
  capacityPerHour: number;
}

export interface MigrationFlow {
  from: DistrictId;
  to: DistrictId;
  purpose: TravelPurpose;
  mode: TransportMode;
  residents: number;
  particles: number;
  bridgeId?: string;
}

export interface CitizenRoute {
  from: DistrictId;
  to: DistrictId;
  purpose: TravelPurpose;
  bridgeId?: string;
}

export interface CitizenAgent {
  id: string;
  name: string;
  age: number;
  homeDistrict: DistrictId;
  workDistrict: DistrictId;
  profession: string;
  hasChildren: boolean;
  childrenAges: number[];
  stress: number;
  currentAction: 'едет на работу' | 'везёт детей в школу' | 'стоит в очереди' | 'дома' | 'работает' | 'едет домой';
  transport: TransportMode;
  income: 'low' | 'middle' | 'high';
  interests: DecisionTopic[];
  routes: CitizenRoute[];
  biography: string;
  speechStyle: string;
  focusGroup: boolean;
}

export interface BridgeTraffic {
  id: string;
  loadRatio: number;
  delayMinutes: number;
  flowPerHour: number;
}

export interface TrafficLoad {
  bridges: readonly BridgeTraffic[];
  /** Ratio, not percent: 1.4 = 140%. */
  districtLoad: Partial<Record<DistrictId, number>>;
}

export interface CityMetrics {
  /** Local game time in Astana, [0,24); never derived from the host timezone. */
  hour: number;
  trafficLoad: TrafficLoad;
  districts?: readonly DistrictAggregate[];
}

export interface DistrictPulse {
  districtId: DistrictId;
  population: number;
  sampledAgents: number;
  averageStress: number | null;
  infrastructureStress: number;
}

export interface CityPulse {
  /** Population-weighted infrastructure index, independent of LLM opinion. */
  stressIndex: number;
  /** Unweighted mean of the supplied cohort; null for macro-only input. */
  averageAgentStress: number | null;
  /** District means weighted by population; null if no agents. */
  populationWeightedAgentStress: number | null;
  status: 'Город дышит спокойно' | 'Повышенное напряжение' | 'Инфраструктурный инфаркт';
  color: 'green' | 'yellow' | 'red';
  pulsing: boolean;
  state: 'Город спит' | 'Утренний коллапс' | 'Рабочий ритм' | 'Вечерний час пик';
  components: { bridges: number; schools: number; heating: number };
  districts: DistrictPulse[];
}

export interface AkimDecision {
  id: string;
  topic: DecisionTopic;
  districtIds: DistrictId[];
  bridgeIds?: string[];
  summary: string;
  effect: 'improve' | 'worsen' | 'mixed';
}

export interface CitizenThought {
  agentId: string;
  quote: string;
  source: 'llm' | 'rules';
}
