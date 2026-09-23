import { describe, expect, it } from 'vitest';
import type { DistrictId } from '../src/engine/types';
import { AUDIT_PROFILES, applyAuditAction, auditDistrict, initialAuditState } from '../src/twin/mapAudit';

describe('local district audit preview', () => {
  it('reproduces the Nura school example and leaves employment migration intact', () => {
    const initial = initialAuditState();
    const before = auditDistrict('nura', initial);
    expect(before).toMatchObject({ schoolDeficit: 65, nearbyJobs: 22, serviceAccess: 40, loadReduction: 0, bridgeReduction: 0 });
    expect(before.flows).toMatchObject([
      { kind: 'schools', target: 'saryarka', count: 12_400, remaining: 1 },
      { kind: 'work', target: 'esil', count: 45_000, remaining: 1 },
      { kind: 'services', target: 'baikonur', count: null, remaining: 1 },
    ]);
    const state = applyAuditAction(initial, 'nura', 'schools');
    const after = auditDistrict('nura', state);
    expect(state.remainingBudget).toBe(45);
    expect(152 - after.loadReduction).toBe(118);
    expect(after).toMatchObject({ schoolDeficit: 25, nearbyJobs: 22, serviceAccess: 40, bridgeReduction: 24 });
    expect(after.flows.map(flow => flow.remaining)).toEqual([0.35, 1, 1]);
    expect(after.flows[1]).toEqual(before.flows[1]);
  });

  it('combines both interventions without charging or applying either twice', () => {
    const schools = applyAuditAction(initialAuditState(), 'nura', 'schools');
    expect(applyAuditAction(schools, 'nura', 'schools')).toBe(schools);
    const both = applyAuditAction(schools, 'nura', 'hub');
    expect(both.remainingBudget).toBe(40);
    expect(applyAuditAction(both, 'nura', 'hub')).toBe(both);
    expect(auditDistrict('nura', both)).toMatchObject({ schoolDeficit: 25, serviceAccess: 80, loadReduction: 46, bridgeReduction: 32 });
    expect(auditDistrict('nura', both).flows.map(flow => flow.remaining)).toEqual([0.35, 1, 0.3]);
    expect(applyAuditAction(applyAuditAction(initialAuditState(), 'nura', 'hub'), 'nura', 'schools')).toEqual(both);
  });

  it('enforces the shared budget and accepts an action costing exactly the remainder', () => {
    const short = { ...initialAuditState(), remainingBudget: 14 };
    expect(applyAuditAction(short, 'nura', 'schools')).toBe(short);
    let state = initialAuditState();
    for (const district of ['nura', 'esil', 'almaty', 'saryarka'] as const) {
      state = applyAuditAction(state, district, 'schools');
    }
    expect(state.remainingBudget).toBe(0);
    expect(state.built.saryarka?.schools).toBe(true);
    expect(applyAuditAction(state, 'baikonur', 'hub')).toBe(state);
  });

  it('isolates effects by district and never mutates earlier state or returned profiles', () => {
    const initial = initialAuditState();
    const initialCopy = structuredClone(initial);
    const nura = applyAuditAction(initial, 'nura', 'schools');
    const nuraCopy = structuredClone(nura);
    const both = applyAuditAction(nura, 'esil', 'hub');
    expect(initial).toEqual(initialCopy);
    expect(nura).toEqual(nuraCopy);
    expect(auditDistrict('nura', both)).toEqual(auditDistrict('nura', nura));
    expect(auditDistrict('esil', nura)).toEqual(auditDistrict('esil', initial));
    const result = auditDistrict('nura', initial);
    result.flows[0].remaining = 0;
    result.flows[0].label = 'changed';
    expect(auditDistrict('nura', initial).flows[0]).toMatchObject({ remaining: 1, label: 'детей → старые гимназии' });
    expect(initialAuditState()).toEqual(initialCopy);
  });

  it('provides valid, bounded previews and external destinations for all six districts', () => {
    const ids = Object.keys(AUDIT_PROFILES) as DistrictId[];
    expect(ids).toHaveLength(6);
    for (const id of ids) {
      const initial = initialAuditState();
      const built = applyAuditAction(applyAuditAction(initial, id, 'schools'), id, 'hub');
      const before = auditDistrict(id, initial);
      const after = auditDistrict(id, built);
      expect(after.schoolDeficit).toBeGreaterThanOrEqual(0);
      expect(after.schoolDeficit).toBeLessThan(before.schoolDeficit);
      expect(after.serviceAccess).toBeGreaterThan(before.serviceAccess);
      expect(after.serviceAccess).toBeLessThanOrEqual(100);
      expect(after.nearbyJobs).toBe(before.nearbyJobs);
      expect(after.flows).toHaveLength(3);
      for (const flow of after.flows) {
        expect(flow.target).not.toBe(id);
        expect(ids).toContain(flow.target);
        expect(flow.remaining).toBeGreaterThan(0);
        expect(flow.remaining).toBeLessThanOrEqual(1);
      }
    }
  });
});
