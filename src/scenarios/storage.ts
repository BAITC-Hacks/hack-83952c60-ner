import { DISTRICTS } from '../data/districts';
import type { DistrictId, SelectedDecision } from '../engine/types';
import { validateDecisions } from '../engine/validator';

export interface SavedScenario {
  id: string;
  name: string;
  createdAt: string;
  decisions: SelectedDecision[];
}

export interface ScenarioDraft {
  decisions: SelectedDecision[];
  selectedDistrictId: DistrictId | null;
}

export const DRAFT_STORAGE_KEY = 'akim.scenario-draft.v1';
export const SCENARIOS_STORAGE_KEY = 'akim.scenario-library.v1';
export const STORAGE_UNAVAILABLE_NOTICE = 'Хранилище браузера недоступно. Работа продолжается в памяти; изменения не сохранятся после перезагрузки.';
export const STORAGE_VERSION = 1;

export interface HydratedScenarioStorage {
  draft: ScenarioDraft;
  scenarios: SavedScenario[];
  notices: string[];
  storage: Storage | null;
  canWriteDraft: boolean;
  canWriteScenarios: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function copyDecisions(decisions: SelectedDecision[]): SelectedDecision[] {
  return decisions.map(({ measureId, districtId }) =>
    districtId === undefined ? { measureId } : { measureId, districtId });
}

function readDraft(value: unknown): ScenarioDraft | null {
  if (!isRecord(value) || !validateDecisions(value.decisions, { allowIncomplete: true }).isValid) return null;
  if (value.selectedDistrictId !== null &&
    (typeof value.selectedDistrictId !== 'string' || !Object.hasOwn(DISTRICTS, value.selectedDistrictId))) return null;
  return {
    decisions: copyDecisions(value.decisions as SelectedDecision[]),
    selectedDistrictId: value.selectedDistrictId as DistrictId | null,
  };
}

function readScenario(value: unknown): SavedScenario | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim() ||
    typeof value.name !== 'string' || !value.name.trim() || typeof value.createdAt !== 'string' ||
    !validateDecisions(value.decisions).isValid) return null;
  const createdAt = new Date(value.createdAt);
  if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== value.createdAt) return null;
  return {
    id: value.id,
    name: value.name.trim(),
    createdAt: value.createdAt,
    decisions: copyDecisions(value.decisions as SelectedDecision[]),
  };
}

/** Reads only: safe to invoke more than once during React StrictMode initialization. */
export function hydrateScenarioStorage(): HydratedScenarioStorage {
  const hydrated: HydratedScenarioStorage = {
    draft: { decisions: [], selectedDistrictId: 'nura' },
    scenarios: [],
    notices: [],
    storage: null,
    canWriteDraft: true,
    canWriteScenarios: true,
  };
  try {
    hydrated.storage = window.localStorage;
  } catch {
    hydrated.canWriteDraft = false;
    hydrated.canWriteScenarios = false;
    hydrated.notices.push(STORAGE_UNAVAILABLE_NOTICE);
    return hydrated;
  }

  const read = (key: string, kind: 'draft' | 'scenarios'): Record<string, unknown> | null => {
    const label = kind === 'draft' ? 'черновика' : 'библиотеки сценариев';
    const disableWrites = () => {
      if (kind === 'draft') hydrated.canWriteDraft = false;
      else hydrated.canWriteScenarios = false;
    };
    let raw: string | null;
    try {
      raw = hydrated.storage!.getItem(key);
    } catch {
      disableWrites();
      if (!hydrated.notices.includes(STORAGE_UNAVAILABLE_NOTICE)) hydrated.notices.push(STORAGE_UNAVAILABLE_NOTICE);
      return null;
    }
    if (raw === null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      hydrated.notices.push(`Повреждённые данные ${label} пропущены.`);
      return null;
    }
    if (!isRecord(parsed) || !Object.hasOwn(parsed, 'version')) {
      hydrated.notices.push(`Повреждённые данные ${label} пропущены.`);
      return null;
    }
    if (parsed.version !== STORAGE_VERSION) {
      disableWrites();
      hydrated.notices.push(`Версия ${label} не поддерживается. Исходные данные сохранены; изменения этой сессии не сохранятся после перезагрузки.`);
      return null;
    }
    return parsed;
  };

  const draftRecord = read(DRAFT_STORAGE_KEY, 'draft');
  if (draftRecord) {
    const draft = readDraft(draftRecord.draft);
    if (draft) hydrated.draft = draft;
    else hydrated.notices.push('Повреждённый черновик пропущен. Начат новый сценарий.');
  }
  const libraryRecord = read(SCENARIOS_STORAGE_KEY, 'scenarios');
  if (libraryRecord) {
    if (!Array.isArray(libraryRecord.scenarios)) {
      hydrated.notices.push('Повреждённые данные библиотеки сценариев пропущены.');
    } else {
      const seenIds = new Set<string>();
      let skipped = 0;
      for (const candidate of libraryRecord.scenarios) {
        const scenario = readScenario(candidate);
        if (!scenario || seenIds.has(scenario.id)) {
          skipped++;
          continue;
        }
        seenIds.add(scenario.id);
        hydrated.scenarios.push(scenario);
      }
      if (skipped) hydrated.notices.push(`Повреждённые или повторяющиеся записи библиотеки пропущены: ${skipped}. Остальные сценарии доступны.`);
    }
  }
  return hydrated;
}
