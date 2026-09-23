import { describe, expect, it } from 'vitest';
import { CONFIG, DIRECTIONS, PROJECTS, advanceMonth, advanceSession, applyAction, initializeCity, initializeSession, population } from '../src/twin/model';
import { STORAGE_KEY, readStore, validSession } from '../src/twin/storage';

describe('digital twin engine', () => {
  it('is deterministic, immutable, and identical to the baseline without intervention for all 60 months', () => {
    const initial = initializeSession();
    let a = initial, b = initializeSession();
    for (let i=0;i<60;i++) { a = advanceSession(a); b = advanceSession(b); }
    expect(a).toEqual(b);
    expect(a.city).toEqual(a.baseline);
    expect(a.city.history).toHaveLength(61);
    expect(initial.city.month).toBe(0);
    expect(advanceMonth(a.city)).toBe(a.city);
    expect(() => applyAction(a.city, { type: 'funding', direction: 'social', value: 1 })).toThrow(/60/);
  });
  it('charges construction immediately, adds capacity only at completion and maintenance next month', () => {
    let city = initializeCity();
    const capacity = city.districts.nura.capacity.social;
    city = applyAction(city, { type:'project', district:'nura', direction:'social' });
    expect(city.budget).toBe(CONFIG.initialBudget-PROJECTS.social.cost);
    expect(city.history[0].budget).toBe(city.budget);
    for (let i=0;i<7;i++) city=advanceMonth(city);
    expect(city.districts.nura.capacity.social).toBe(capacity);
    const before = city;
    city = advanceMonth(city);
    expect(city.projects[0].completed).toBe(8);
    expect(city.districts.nura.capacity.social).toBe(capacity+PROJECTS.social.capacity);
    expect(city.finance.requested).toBeCloseTo(population(before)*CONFIG.operatingPerResident*5);
    const completed = city;
    city=advanceMonth(city);
    expect(city.finance.requested).toBeCloseTo(population(completed)*CONFIG.operatingPerResident*5+PROJECTS.social.upkeep);
  });
  it('rejects unaffordable projects without mutation and allows repeated projects', () => {
    let city=initializeCity();
    for (let i=0;i<5;i++) city=applyAction(city,{type:'project',district:'esil',direction:'transport'});
    expect(city.projects).toHaveLength(5);
    expect(city.budget).toBe(0);
    expect(() => applyAction(city,{type:'project',district:'esil',direction:'transport'})).toThrow(/Недостаточно/);
    expect(city.projects).toHaveLength(5);
  });
  it('applies funding on the next step and underfunding accelerates wear', () => {
    const start=initializeCity();
    const low=applyAction(start,{type:'funding',direction:'services',value:0});
    const high=applyAction(start,{type:'funding',direction:'services',value:1.5});
    expect(low.funding.services).toBe(1);
    expect(low.districts).toEqual(start.districts);
    expect(advanceMonth(low).districts.esil.condition.services).toBeLessThan(advanceMonth(start).districts.esil.condition.services);
    expect(advanceMonth(high).districts.esil.condition.services).toBeGreaterThan(start.districts.esil.condition.services);
    expect(() => applyAction(start,{type:'funding',direction:'social',value:NaN})).toThrow();
  });
  it('scales all operating spending proportionally during a deficit without debt', () => {
    let city=initializeCity(); city.budget=0;
    for (const direction of DIRECTIONS) city=applyAction(city,{type:'funding',direction,value:1.5});
    const next=advanceMonth(city);
    expect(next.budget).toBe(0);
    expect(next.finance.ratio).toBeCloseTo(next.finance.revenue/next.finance.requested);
    expect(next.finance.spent).toBeCloseTo(next.finance.revenue);
    for (const k of DIRECTIONS) expect(next.districts.nura.condition[k]-city.districts.nura.condition[k]).toBeCloseTo(-CONFIG.wear+(1.5*next.finance.ratio-1)*CONFIG.repair);
    expect(next.journal.some(e=>e.text.includes('Дефицит'))).toBe(true);
  });
  it('growing population raises load at equal season; transport investment reduces load and improves ecology', () => {
    const start=initializeCity();
    let normal=start, invested=applyAction(start,{type:'project',district:'nura',direction:'transport'});
    for(let i=0;i<13;i++) {normal=advanceMonth(normal); invested=advanceMonth(invested);}
    expect(normal.districts.nura.population).toBeGreaterThan(start.districts.nura.population);
    expect(normal.districts.nura.load).toBeGreaterThan(start.districts.nura.load);
    expect(invested.districts.nura.load).toBeLessThan(normal.districts.nura.load);
    expect(invested.districts.nura.quality.ecology).toBeGreaterThan(normal.districts.nura.quality.ecology);
  });
  it('resumes the exact trajectory through serialization, including pending funding and projects', () => {
    let session=initializeSession();
    session.city=applyAction(session.city,{type:'project',district:'nura',direction:'social'});
    for(let i=0;i<4;i++) session=advanceSession(session);
    session.city=applyAction(session.city,{type:'funding',direction:'transport',value:1.4});
    const restored=readStore({getItem:()=>JSON.stringify({version:1,draft:session,snapshots:[]})});
    expect(restored.notice).toBe('');
    let original=session, copy=restored.draft;
    for(let i=0;i<56;i++){original=advanceSession(original);copy=advanceSession(copy);}
    expect(copy).toEqual(original);
    expect(validSession(copy)).toBe(true);
  });
});

describe('twin storage validation', () => {
  it('uses its own storage key and preserves valid snapshots when the draft is invalid', () => {
    const session=initializeSession();
    const read=readStore({ getItem:key=>{
      expect(key).toBe(STORAGE_KEY);
      return JSON.stringify({version:1,draft:{broken:true},snapshots:[{id:'one',name:'Valid',savedAt:'2026-09-23',session},{id:'broken'}]});
    }});
    expect(read.snapshots).toHaveLength(1);
    expect(read.notice).toMatch(/пропущены/);
    expect(validSession(read.draft)).toBe(true);
  });
  it('rejects incompatible versions, malformed nested fields and invalid month alignment', () => {
    const session=initializeSession();
    expect(validSession({...session,version:99})).toBe(false);
    expect(validSession({...session,city:{...session.city,districts:{}}})).toBe(false);
    expect(validSession({...session,baseline:advanceMonth(session.baseline)})).toBe(false);
    expect(validSession({...session,city:{...session.city,history:[]}})).toBe(false);
    expect(readStore({getItem:()=>'{bad json'}).notice).not.toBe('');
    expect(readStore({getItem:()=>{throw new Error('Denied');}}).notice).toMatch(/памяти/);
  });
});
