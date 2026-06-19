/**
 * Unit tests for lib/dailyRecord — the canonical emotion sets and the
 * `source` backfill helper for EmotionRecord. See ADR-0001 for why a dedicated
 * `source` field replaces the old `copingMethod?.includes('sos')` string match.
 */

import { describe, it, expect } from 'vitest';
import {
  DAILY_EMOTIONS,
  SOS_EMOTIONS,
  POSITIVE_EMOTIONS,
  resolveSource,
  isPositiveEmotion,
} from '../dailyRecord';
import type { EmotionRecord } from '../../types/storage';

const mkRecord = (over: Partial<EmotionRecord>): EmotionRecord => ({
  id: `e_${Math.random().toString(36).slice(2)}`,
  emotion: 'anxiety',
  intensity: 5,
  timestamp: Date.now(),
  ...over,
});

describe('DAILY_EMOTIONS', () => {
  it('has exactly 10 emotion keys', () => {
    expect(DAILY_EMOTIONS).toHaveLength(10);
  });

  it('contains the 6 negative emotions (SOS subset)', () => {
    const negativeKeys = ['anxiety', 'anger', 'sadness', 'panic', 'overwhelm', 'exhaustion'];
    negativeKeys.forEach((key) => {
      expect(DAILY_EMOTIONS.find((e) => e.key === key)).toBeTruthy();
    });
  });

  it('contains the 4 positive emotions (calm/happy/gratitude/relax)', () => {
    const positiveKeys = ['calm', 'happy', 'gratitude', 'relax'];
    positiveKeys.forEach((key) => {
      expect(DAILY_EMOTIONS.find((e) => e.key === key)).toBeTruthy();
    });
  });

  it('every emotion has a key, emoji and label', () => {
    DAILY_EMOTIONS.forEach((e) => {
      expect(e.key).toBeTruthy();
      expect(e.emoji).toBeTruthy();
      expect(e.label).toBeTruthy();
    });
  });
});

describe('SOS_EMOTIONS', () => {
  it('is a subset of DAILY_EMOTIONS and only negative', () => {
    const dailyKeys = new Set(DAILY_EMOTIONS.map((e) => e.key));
    SOS_EMOTIONS.forEach((e) => {
      expect(dailyKeys.has(e.key)).toBe(true);
      expect(POSITIVE_EMOTIONS).not.toContain(e.key);
    });
  });

  it('has exactly the 6 negative emotions', () => {
    expect(SOS_EMOTIONS).toHaveLength(6);
  });
});

describe('isPositiveEmotion', () => {
  it('returns true for the 4 positive emotion keys', () => {
    expect(isPositiveEmotion('calm')).toBe(true);
    expect(isPositiveEmotion('happy')).toBe(true);
    expect(isPositiveEmotion('gratitude')).toBe(true);
    expect(isPositiveEmotion('relax')).toBe(true);
  });

  it('returns false for negative emotions and unknown keys', () => {
    expect(isPositiveEmotion('anxiety')).toBe(false);
    expect(isPositiveEmotion('sadness')).toBe(false);
    expect(isPositiveEmotion('unknown')).toBe(false);
  });
});

describe('resolveSource', () => {
  it('returns the explicit source when present', () => {
    expect(resolveSource(mkRecord({ source: 'daily' }))).toBe('daily');
    expect(resolveSource(mkRecord({ source: 'sos' }))).toBe('sos');
    expect(resolveSource(mkRecord({ source: 'chat' }))).toBe('chat');
  });

  it('falls back to sos when copingMethod contains "sos" (legacy SOS records)', () => {
    // mirrors insights.ts:86 legacy convention: copingMethod?.includes('sos')
    expect(resolveSource(mkRecord({ copingMethod: 'sos-first-aid' }))).toBe('sos');
    expect(resolveSource(mkRecord({ copingMethod: 'sos-initial' }))).toBe('sos');
  });

  it('falls back to daily when copingMethod exists but has no sos marker', () => {
    expect(resolveSource(mkRecord({ copingMethod: 'breathing' }))).toBe('daily');
    expect(resolveSource(mkRecord({ copingMethod: 'other' }))).toBe('daily');
  });

  it('falls back to daily when neither source nor copingMethod is set', () => {
    expect(resolveSource(mkRecord({}))).toBe('daily');
  });
});
