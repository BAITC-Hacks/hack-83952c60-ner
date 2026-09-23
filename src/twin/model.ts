import { DISTRICT_LIST } from '../data/districts';
import { DirectionId, DistrictId, IndicatorId, SelectedDecision } from '../engine/types';
import { MEASURES, SYNERGIES } from '../data/measures';
import { validateDecisions } from '../engine/validator';
export const DIRECTIONS: DirectionId[] = ['transport', 'ecology', 'social', 'safety', 'services'];
export const LABELS: Record<DirectionId, string> = { transport: 'Транспорт', ecology: 'Экология', social: 'Социальные услуги', safety: 'Безопасность', services: 'ЖКХ' };
// Money: fictional units; capacity: residents served; condition and quality: 0–100.
export const CONFIG = {
  version: 1, horizon: 60, population: 1_000_000, initialBudget: 2400,
  revenuePerResident: 0.00042, operatingPerResident: 0.000075,
  growth: 0.0018, growthQualityReference: 60, growthQualityFactor: 0.00002,
  wear: 0.22, repair: 0.65, congestionPenalty: 0.12, minimumTransportCondition: 0.1,
  initialCapacityBase: 0.65, initialCapacityScoreDivisor: 160,
  initialConditionBase: 45, initialConditionScoreFactor: 0.5,
  seasonalDemand: [1.12, 1.10, 1.05, 1, 0.98, 0.96, 0.95, 0.98, 1.05, 1.06, 1.09, 1.13],
};
export const PROJECTS: Record<DirectionId, { name: string; cost: number; months: number; capacity: number; repair: number; upkeep: number }> = {
  transport: { name: 'Транспортный узел', cost: 480, months: 6, capacity: 40000, repair: 6, upkeep: 7 },
  ecology: { name: 'Зелёный пояс', cost: 260, months: 4, capacity: 30000, repair: 8, upkeep: 4 },
  social: { name: 'Школа и поликлиника', cost: 540, months: 8, capacity: 45000, repair: 5, upkeep: 9 },
  safety: { name: 'Центр городских служб', cost: 300, months: 3, capacity: 35000, repair: 7, upkeep: 5 },
  services: { name: 'Обновление коммунальных сетей', cost: 420, months: 5, capacity: 40000, repair: 12, upkeep: 6 },
};
type Systems<T> = Record<DirectionId, T>;
export interface District { id: DistrictId; population: number; capacity: Systems<number>; condition: Systems<number>; quality: Systems<number>; load: number }
export interface Project { id: number; district: DistrictId; direction: DirectionId; started: number; completed: number | null }
export interface Point { month: number; population: number; budget: number; quality: number; districts: Record<DistrictId, { population: number; load: number; quality: Systems<number> }> }
export interface City {
  mandate?: { decisions: SelectedDecision[]; started: number };
  month: number; budget: number; districts: Record<DistrictId, District>; funding: Systems<number>; pendingFunding: Systems<number>;
  projects: Project[]; history: Point[]; journal: { month: number; text: string }[];
  finance: { revenue: number; requested: number; spent: number; ratio: number };
}
export interface TwinSession { version: number; city: City; baseline: City }
export type Action = { type: 'project'; district: DistrictId; direction: DirectionId } | { type: 'funding'; direction: DirectionId; value: number };
export const systems = (value: number): Systems<number> => Object.fromEntries(DIRECTIONS.map(d => [d, value])) as Systems<number>;
const clamp = (n: number) => Math.min(100, Math.max(0, n));
const indicators: Record<DirectionId, [IndicatorId, IndicatorId]> = { transport: ['T1','T2'], ecology: ['E1','E2'], social: ['S1','S2'], safety: ['B1','B2'], services: ['C1','C2'] };
export const population = (city: City) => Object.values(city.districts).reduce((s, d) => s + d.population, 0);
export const quality = (city: City) => Object.values(city.districts).reduce((s,d) => s + d.population * DIRECTIONS.reduce((a,k) => a + d.quality[k], 0) / 5, 0) / population(city);
function calculate(d: District, month: number) {
  const season = CONFIG.seasonalDemand[Math.max(0, month - 1) % 12];
  d.load = d.population * season / (d.capacity.transport * Math.max(CONFIG.minimumTransportCondition, d.condition.transport / 100)) * 100;
  for (const k of DIRECTIONS) {
    const demand = d.population * (k === 'transport' || k === 'services' ? season : 1);
    d.quality[k] = clamp(Math.min(1, d.capacity[k] / demand) * d.condition[k] - (k === 'ecology' ? Math.max(0, d.load - 100) * CONFIG.congestionPenalty : 0));
  }
}
function point(city: City): Point {
  return { month: city.month, population: population(city), budget: city.budget, quality: quality(city), districts: Object.fromEntries(Object.values(city.districts).map(d => [d.id, { population: d.population, load: d.load, quality: { ...d.quality } }])) as Point['districts'] };
}
export function initializeCity(): City {
  const shares = DISTRICT_LIST.reduce((s,d) => s + d.populationShare, 0);
  const districts = Object.fromEntries(DISTRICT_LIST.map(d => {
    const population = CONFIG.population * d.populationShare / shares;
    const district: District = { id: d.id, population, capacity: systems(0), condition: systems(0), quality: systems(0), load: 0 };
    for (const k of DIRECTIONS) {
      const [a,b] = indicators[k];
      const score = (d.indicators[a] + d.indicators[b]) / 2;
      district.capacity[k] = population * (CONFIG.initialCapacityBase + score / CONFIG.initialCapacityScoreDivisor);
      district.condition[k] = CONFIG.initialConditionBase + score * CONFIG.initialConditionScoreFactor;
    }
    calculate(district, 0);
    return [d.id, district];
  })) as City['districts'];
  const city: City = { month: 0, budget: CONFIG.initialBudget, districts, funding: systems(1), pendingFunding: systems(1), projects: [], history: [], journal: [], finance: { revenue: 0, requested: 0, spent: 0, ratio: 1 } };
  city.history.push(point(city));
  return city;
}
export const initializeSession = (): TwinSession => ({ version: CONFIG.version, city: initializeCity(), baseline: initializeCity() });
// Explicit conversion between the two fictional budget scales.
export const DECISION_COST_SCALE = 10;
export function applyMandate(city: City, decisions: SelectedDecision[]): City {
  const validation = validateDecisions(decisions);
  if (!validation.isValid) throw new Error(validation.errors.join(' '));
  if (city.mandate) throw new Error('Пять решений уже приняты. Для другого набора начните новый сценарий.');
  if (city.month >= CONFIG.horizon) throw new Error('Горизонт 60 месяцев завершён.');
  const cost = validation.totalCost * DECISION_COST_SCALE;
  if (city.budget < cost) throw new Error('Недостаточно средств для пяти решений.');
  const next = structuredClone(city);
  next.budget -= cost;
  next.mandate = { decisions: structuredClone(decisions), started: city.month };
  next.journal.push({ month: city.month, text: `Приняты пять решений акима. Списано ${cost} у.е. (1 единица бюджета решений = ${DECISION_COST_SCALE} у.е.).` });
  next.history[next.month] = point(next);
  return next;
}
function realizeMandate(city: City) {
  if (!city.mandate) return;
  const { decisions, started } = city.mandate;
  const elapsed = city.month - started;
  const affect = (district: DistrictId, effects: Partial<Record<IndicatorId, number>>) => {
    for (const k of DIRECTIONS) {
      const [a, b] = indicators[k];
      const change = ((effects[a] ?? 0) + (effects[b] ?? 0)) / 2;
      city.districts[district].condition[k] = clamp(city.districts[district].condition[k] + change);
    }
  };
  for (const decision of decisions) {
    const measure = MEASURES[decision.measureId];
    if (elapsed !== measure.lag * 3) continue;
    const targets = measure.type === 'Город' ? DISTRICT_LIST.map(d => d.id) : [decision.districtId!];
    targets.forEach(id => affect(id, measure.effects));
    city.journal.push({ month: city.month, text: `${measure.nameRu}: эффект введён · ${targets.map(id => DISTRICT_LIST.find(d => d.id === id)!.nameRu).join(', ')}. Учтены положительные и отрицательные эффекты.` });
  }
  for (const rule of SYNERGIES) {
    const first = decisions.find(d => d.measureId === rule.pair[0]);
    const second = decisions.find(d => d.measureId === rule.pair[1]);
    if (!first?.districtId || !second || elapsed !== Math.max(...rule.pair.map(id => MEASURES[id].lag * 3))) continue;
    affect(first.districtId, rule.bonus);
    city.journal.push({ month: city.month, text: `Сочетание решений: ${rule.descriptionRu}` });
  }
}
export function applyAction(city: City, action: Action): City {
  if (city.month >= CONFIG.horizon) throw new Error('Горизонт 60 месяцев завершён. Начните новый сценарий.');
  if (!DIRECTIONS.includes(action.direction)) throw new Error('Неизвестное направление.');
  const next: City = structuredClone(city);
  if (action.type === 'funding') {
    if (!Number.isFinite(action.value) || action.value < 0 || action.value > 1.5) throw new Error('Финансирование должно быть от 0 до 150%.');
    next.pendingFunding[action.direction] = action.value;
  } else {
    if (!city.districts[action.district]) throw new Error('Неизвестный район.');
    const project = PROJECTS[action.direction];
    if (city.budget < project.cost) throw new Error('Недостаточно средств для запуска проекта.');
    next.budget -= project.cost;
    next.projects.push({ id: next.projects.length + 1, district: action.district, direction: action.direction, started: city.month, completed: null });
    next.journal.push({ month: city.month, text: `${project.name}: начало строительства в районе ${DISTRICT_LIST.find(d => d.id === action.district)!.nameRu}. Списано ${project.cost} у.е.` });
    next.history[next.month] = point(next);
  }
  return next;
}
export function advanceMonth(city: City): City {
  if (city.month >= CONFIG.horizon) return city;
  const next: City = structuredClone(city);
  next.month++;
  realizeMandate(next);
  for (const k of DIRECTIONS) if (next.funding[k] !== next.pendingFunding[k]) next.journal.push({ month: next.month, text: `${LABELS[k]}: финансирование изменено до ${Math.round(next.pendingFunding[k] * 100)}%.` });
  next.funding = { ...next.pendingFunding };
  const residents = population(city);
  const revenue = residents * CONFIG.revenuePerResident;
  const costs = systems(0);
  for (const k of DIRECTIONS) costs[k] = (residents * CONFIG.operatingPerResident + city.projects.filter(p => p.direction === k && p.completed !== null).length * PROJECTS[k].upkeep) * next.funding[k];
  const requested = Object.values(costs).reduce((a,b) => a+b,0);
  const spent = Math.min(requested, next.budget + revenue);
  const ratio = requested > 0 ? spent / requested : 1;
  next.budget = Math.max(0, next.budget + revenue - spent);
  next.finance = { revenue, requested, spent, ratio };
  if (ratio < 1) next.journal.push({ month: next.month, text: `Дефицит: оплачено ${(ratio * 100).toFixed(1)}% запрошенных расходов. Все направления сокращены пропорционально.` });
  for (const p of next.projects) if (p.completed === null && next.month - p.started >= PROJECTS[p.direction].months) {
    const spec = PROJECTS[p.direction];
    p.completed = next.month;
    next.districts[p.district].capacity[p.direction] += spec.capacity;
    next.districts[p.district].condition[p.direction] = clamp(next.districts[p.district].condition[p.direction] + spec.repair);
    next.journal.push({ month: next.month, text: `${spec.name} — ${DISTRICT_LIST.find(d => d.id === p.district)!.nameRu}: введён в эксплуатацию, мощность +${spec.capacity.toLocaleString('ru-RU')} жителей. Содержание со следующего месяца: ${spec.upkeep} у.е./мес. при 100%.` });
  }
  for (const d of Object.values(next.districts)) {
    const prior = city.districts[d.id];
    const average = DIRECTIONS.reduce((s,k) => s + prior.quality[k],0) / 5;
    d.population *= 1 + CONFIG.growth + (average - CONFIG.growthQualityReference) * CONFIG.growthQualityFactor;
    for (const k of DIRECTIONS) d.condition[k] = clamp(d.condition[k] - CONFIG.wear + (next.funding[k] * ratio - 1) * CONFIG.repair);
    calculate(d, next.month);
  }
  next.journal.push({ month: next.month, text: `Население +${Math.round(population(next) - residents)}; сезонный спрос ×${CONFIG.seasonalDemand[(next.month - 1) % 12].toFixed(2)}. Рост спроса увеличивает нагрузку; содержание влияет на износ, перегрузка транспорта — на экологию.` });
  next.history.push(point(next));
  return next;
}
export const advanceSession = (session: TwinSession): TwinSession => ({ ...session, city: advanceMonth(session.city), baseline: advanceMonth(session.baseline) });
