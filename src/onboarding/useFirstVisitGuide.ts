import { useState } from 'react';

export const GUIDE_STORAGE_KEY = 'akim.first-visit.v1';
export const GUIDE_STEPS = ['district', 'problem', 'measures', 'review'] as const;
export type GuideStep = typeof GUIDE_STEPS[number];

export function useFirstVisitGuide(hasSavedWork: boolean) {
  const [step, setStep] = useState<GuideStep | null>(() => {
    try {
      const saved = localStorage.getItem(GUIDE_STORAGE_KEY);
      if (saved === 'complete' || saved === 'skipped') return null;
    } catch { /* The guide also works when browser storage is unavailable. */ }
    // Existing plans are left ready to use; the header can reopen the guide.
    return hasSavedWork ? null : 'district';
  });

  const dismiss = (result: 'complete' | 'skipped') => {
    setStep(null);
    try { localStorage.setItem(GUIDE_STORAGE_KEY, result); }
    catch { /* Keep the guide dismissed for the current session. */ }
  };
  return { step, setStep, dismiss };
}
