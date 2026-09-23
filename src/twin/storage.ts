import { useEffect, useState } from 'react';
import { CONFIG, DIRECTIONS, City, TwinSession, initializeSession } from './model';
import { DISTRICT_LIST } from '../data/districts';
import { validateDecisions } from '../engine/validator';

export const STORAGE_KEY = 'akim.digital-twin.v1';
export interface Snapshot { id: string; name: string; savedAt: string; session: TwinSession }
interface Store { draft: TwinSession; snapshots: Snapshot[] }
const record = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const number = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (v: unknown, max = 60) => number(v, 0, max) && Number.isInteger(v);
const systems = (v: unknown, max = Number.MAX_SAFE_INTEGER) => record(v) && DIRECTIONS.every(k => number(v[k], 0, max));
function validCity(v: unknown): v is City {
  if (!record(v) || !integer(v.month) || !number(v.budget) || !systems(v.funding, 1.5) || !systems(v.pendingFunding, 1.5) || !record(v.districts)) return false;
  if (v.mandate !== undefined && (!record(v.mandate) || !integer(v.mandate.started, v.month) || !validateDecisions(v.mandate.decisions).isValid)) return false;
  if (Object.keys(v.districts).length !== DISTRICT_LIST.length || !DISTRICT_LIST.every(({id}) => {
    const d = v.districts[id];
    return record(d) && d.id === id && number(d.population, 1) && systems(d.capacity) && DIRECTIONS.every(k => d.capacity[k] > 0) && systems(d.condition, 100) && systems(d.quality, 100) && number(d.load);
  })) return false;
  if (!Array.isArray(v.projects) || !v.projects.every((p: unknown, i: number) => record(p) && p.id === i + 1 && DISTRICT_LIST.some(d => d.id === p.district) && DIRECTIONS.includes(p.direction) && integer(p.started, v.month) && (p.completed === null || (integer(p.completed, v.month) && p.completed > p.started)))) return false;
  if (!Array.isArray(v.history) || v.history.length !== v.month + 1 || !v.history.every((p: unknown, i: number) => record(p) && p.month === i && number(p.population, 1) && number(p.budget) && number(p.quality, 0, 100) && record(p.districts) && DISTRICT_LIST.every(({id}) => {
    const d = p.districts[id];
    return record(d) && number(d.population, 1) && number(d.load) && systems(d.quality, 100);
  }))) return false;
  return Array.isArray(v.journal) && v.journal.every((e: unknown) => record(e) && integer(e.month, v.month) && typeof e.text === 'string') && record(v.finance) && ['revenue','requested','spent'].every(k => number(v.finance[k])) && number(v.finance.ratio, 0, 1);
}
export function validSession(v: unknown): v is TwinSession {
  return record(v) && v.version === CONFIG.version && validCity(v.city) && validCity(v.baseline) && v.city.month === v.baseline.month;
}
export function readStore(storage: Pick<Storage, 'getItem'>): Store & { notice: string } {
  const fallback = { draft: initializeSession(), snapshots: [], notice: '' };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!record(parsed) || parsed.version !== CONFIG.version || !Array.isArray(parsed.snapshots)) return { ...fallback, notice: 'Сохранение повреждено или версия модели несовместима. Открыт новый сценарий.' };
    const snapshots: Snapshot[] = parsed.snapshots.filter((s: unknown) => record(s) && typeof s.id === 'string' && typeof s.name === 'string' && s.name.trim().length > 0 && typeof s.savedAt === 'string' && validSession(s.session));
    const draft = validSession(parsed.draft) ? parsed.draft : fallback.draft;
    return { draft, snapshots, notice: draft !== parsed.draft || snapshots.length !== parsed.snapshots.length ? 'Повреждённые или несовместимые записи пропущены. Корректные сценарии сохранены.' : '' };
  } catch {
    return { ...fallback, notice: 'Не удалось прочитать сохранение. Работа продолжится в памяти; данные могут не сохраниться после перезагрузки.' };
  }
}
export function useTwinStorage() {
  const [initial] = useState(() => {
    try { return readStore(window.localStorage); }
    catch { return { draft: initializeSession(), snapshots: [] as Snapshot[], notice: 'Хранилище недоступно. Работа продолжается в памяти.' }; }
  });
  const [session, setSession] = useState(initial.draft);
  const [snapshots, setSnapshots] = useState(initial.snapshots);
  const [notice, setNotice] = useState(initial.notice);
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CONFIG.version, draft: session, snapshots })); }
    catch { setNotice('Не удалось сохранить изменения. Работа продолжается в памяти; после перезагрузки изменения могут быть потеряны.'); }
  }, [session, snapshots]);
  const save = (name: string) => {
    if (!name.trim()) return;
    setSnapshots(s => [{ id: crypto.randomUUID(), name: name.trim().slice(0, 100), savedAt: new Date().toISOString(), session: structuredClone(session) }, ...s]);
  };
  return { session, setSession, snapshots, save, remove: (id: string) => setSnapshots(s => s.filter(x => x.id !== id)), notice };
}
