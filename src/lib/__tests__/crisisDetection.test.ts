/**
 * Unit tests for lib/crisisDetection — the shared crisis-detection module.
 * Extracted from enhancedChatService so both the chat path and the daily-record
 * path use the same keywords, hotline, and intervention copy (Issue #8).
 */

import { describe, it, expect } from 'vitest';
import {
  CRISIS_HOTLINE,
  detectCrisis,
  buildCrisisIntervention,
} from '../crisisDetection';

describe('CRISIS_HOTLINE', () => {
  it('is the national 24h crisis hotline number', () => {
    expect(CRISIS_HOTLINE).toBe('400-161-9995');
  });
});

describe('detectCrisis', () => {
  it('detects self-harm keywords', () => {
    expect(detectCrisis('我真的不想活了')).toEqual({ crisis: true, type: 'self_harm' });
    expect(detectCrisis('有时候想结束这一切')).toEqual({ crisis: true, type: 'self_harm' });
    expect(detectCrisis('想死')).toEqual({ crisis: true, type: 'self_harm' });
  });

  it('detects panic keywords', () => {
    expect(detectCrisis('我喘不上气')).toEqual({ crisis: true, type: 'panic' });
    expect(detectCrisis('快要崩溃了')).toEqual({ crisis: true, type: 'panic' });
    expect(detectCrisis('惊恐发作')).toEqual({ crisis: true, type: 'panic' });
  });

  it('returns no crisis for normal text', () => {
    expect(detectCrisis('今天开会压力很大')).toEqual({ crisis: false });
    expect(detectCrisis('感觉有点累')).toEqual({ crisis: false });
    expect(detectCrisis('')).toEqual({ crisis: false });
  });

  it('prioritizes self_harm over panic when both match', () => {
    // a message containing both a self-harm and a panic keyword
    expect(detectCrisis('我崩溃了，不想活了')).toEqual({ crisis: true, type: 'self_harm' });
  });
});

describe('buildCrisisIntervention', () => {
  it('includes the hotline for self_harm', () => {
    const msg = buildCrisisIntervention('self_harm');
    expect(msg).toContain(CRISIS_HOTLINE);
    expect(msg.length).toBeGreaterThan(0);
  });

  it('points to SOS for panic (no hotline required)', () => {
    const msg = buildCrisisIntervention('panic');
    // panic intervention should mention SOS / breathing, not the hotline
    expect(msg).toContain('SOS');
    expect(msg).not.toContain(CRISIS_HOTLINE);
  });

  it('is non-empty for any input', () => {
    expect(buildCrisisIntervention('self_harm').length).toBeGreaterThan(0);
    expect(buildCrisisIntervention('panic').length).toBeGreaterThan(0);
  });
});
