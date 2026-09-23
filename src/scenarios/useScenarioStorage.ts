import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SelectedDecision } from '../engine/types';
import { validateDecisions } from '../engine/validator';
import {
  copyDecisions, DRAFT_STORAGE_KEY, hydrateScenarioStorage, SCENARIOS_STORAGE_KEY,
  STORAGE_UNAVAILABLE_NOTICE, STORAGE_VERSION,
} from './storage';
import type { SavedScenario, ScenarioDraft } from './storage';

export interface ScenarioStorageState {
  draft: ScenarioDraft;
  setDraft: Dispatch<SetStateAction<ScenarioDraft>>;
  scenarios: SavedScenario[];
  saveScenario: (name: string, decisions: SelectedDecision[]) => boolean;
  deleteScenario: (id: string) => void;
  notices: string[];
}

let nextId = 0;

export function useScenarioStorage(): ScenarioStorageState {
  // Hydrate before either persistence effect can run, including under StrictMode.
  const [initial] = useState(hydrateScenarioStorage);
  const [draft, setDraft] = useState(initial.draft);
  const [scenarios, setScenarios] = useState(initial.scenarios);
  const [notices, setNotices] = useState(initial.notices);
  const writable = useRef({ draft: initial.canWriteDraft, scenarios: initial.canWriteScenarios });
  const usedIds = useRef(new Set(initial.scenarios.map(({ id }) => id)));

  const persist = useCallback((key: string, kind: 'draft' | 'scenarios', value: unknown) => {
    if (!writable.current[kind] || !initial.storage) return;
    try {
      initial.storage.setItem(key, JSON.stringify(value));
    } catch {
      // Avoid repeated quota/security failures while retaining all state in memory.
      writable.current.draft = false;
      writable.current.scenarios = false;
      setNotices((previous) => previous.includes(STORAGE_UNAVAILABLE_NOTICE)
        ? previous : [...previous, STORAGE_UNAVAILABLE_NOTICE]);
    }
  }, [initial]);

  useEffect(() => {
    persist(DRAFT_STORAGE_KEY, 'draft', {
      version: STORAGE_VERSION,
      draft: { decisions: copyDecisions(draft.decisions), selectedDistrictId: draft.selectedDistrictId },
    });
  }, [draft, persist]);

  useEffect(() => {
    persist(SCENARIOS_STORAGE_KEY, 'scenarios', { version: STORAGE_VERSION, scenarios });
  }, [scenarios, persist]);

  const saveScenario = useCallback((name: string, decisions: SelectedDecision[]): boolean => {
    const trimmedName = name.trim();
    if (!trimmedName || !validateDecisions(decisions).isValid) return false;
    let id: string = globalThis.crypto?.randomUUID?.() ?? `scenario-${Date.now()}-${++nextId}`;
    while (usedIds.current.has(id)) id = `scenario-${Date.now()}-${++nextId}`;
    usedIds.current.add(id);
    const scenario: SavedScenario = {
      id, name: trimmedName, createdAt: new Date().toISOString(), decisions: copyDecisions(decisions),
    };
    setScenarios((previous) => [...previous, scenario]);
    return true;
  }, []);

  const deleteScenario = useCallback((id: string) => {
    setScenarios((previous) => previous.filter((scenario) => scenario.id !== id));
  }, []);

  return { draft, setDraft, scenarios, saveScenario, deleteScenario, notices };
}
