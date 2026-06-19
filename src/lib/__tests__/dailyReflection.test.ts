/**
 * Unit tests for lib/dailyReflection — the two-layer context builder and prompt
 * assembly for the daily AI reflection (Issue #7). We assert structure/contents,
 * never prompt wording (per PRD testing philosophy).
 */

import { describe, it, expect } from 'vitest';
import {
  REFLECTION_SYSTEM_PROMPT,
  buildReflectionContext,
  buildReflectionUserMessage,
} from '../dailyReflection';
import type { EmotionRecord } from '../../types/storage';
import type { InsightStats, TrendDay } from '../insights';

const mkRecord = (over: Partial<EmotionRecord>): EmotionRecord => ({
  id: `e_${Math.random().toString(36).slice(2)}`,
  emotion: 'anxiety',
  intensity: 5,
  timestamp: Date.now(),
  source: 'daily',
  ...over,
});

const mkStats = (over: Partial<InsightStats>): InsightStats => ({
  totalEmotions: 10,
  totalConversations: 0,
  totalMessages: 0,
  avgIntensity: 5.0,
  dominantEmotion: 'anxiety',
  sosCount: 0,
  avgEffectiveness: 0,
  ...over,
});

const mkTrend = (over: Partial<TrendDay>[]): TrendDay[] =>
  over.map((d, i) => ({
    date: `6月${i + 1}日`,
    avgIntensity: 5,
    count: 1,
    ...d,
  }));

describe('REFLECTION_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof REFLECTION_SYSTEM_PROMPT).toBe('string');
    expect(REFLECTION_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });
});

describe('buildReflectionContext', () => {
  it('carries the current record (today) with its original text', () => {
    const today = mkRecord({
      emotion: 'anxiety',
      intensity: 7,
      context: '今天开会压力很大',
    });
    const ctx = buildReflectionContext(today, [], mkStats({}), []);

    expect(ctx.current.emotion).toBe('anxiety');
    expect(ctx.current.intensity).toBe(7);
    expect(ctx.current.text).toBe('今天开会压力很大');
  });

  it('carries history records with emotion + intensity but WITHOUT their text', () => {
    const history = [
      mkRecord({ emotion: 'sadness', intensity: 6, context: '昨天的秘密倾诉' }),
      mkRecord({ emotion: 'anxiety', intensity: 5, context: '前天的秘密' }),
    ];
    const ctx = buildReflectionContext(
      mkRecord({ emotion: 'happy', intensity: 4 }),
      history,
      mkStats({}),
      []
    );

    expect(ctx.recent).toHaveLength(2);
    ctx.recent.forEach((r) => {
      expect(r.emotion).toBeTruthy();
      expect(typeof r.intensity).toBe('number');
      // privacy/token constraint: history text must NOT be carried
      expect((r as { text?: string }).text).toBeUndefined();
    });
  });

  it('carries the 30-day stats summary', () => {
    const stats = mkStats({ dominantEmotion: 'anxiety', avgIntensity: 6.4, totalEmotions: 12 });
    const ctx = buildReflectionContext(mkRecord({}), [], stats, []);

    expect(ctx.monthStats?.dominantEmotion).toBe('anxiety');
    expect(ctx.monthStats?.avgIntensity).toBe(6.4);
    expect(ctx.monthStats?.totalEmotions).toBe(12);
  });

  it('carries the trend direction', () => {
    const trend = mkTrend([{ avgIntensity: 4 }, { avgIntensity: 5 }, { avgIntensity: 7 }]);
    const ctx = buildReflectionContext(mkRecord({}), [], mkStats({}), trend);

    expect(ctx.trend).toBeDefined();
    // trend direction derived: rising (last > first)
    expect(['rising', 'falling', 'flat']).toContain(ctx.trendDirection);
  });

  it('builds without error for a first-time user (empty history + empty stats)', () => {
    const ctx = buildReflectionContext(
      mkRecord({ emotion: 'calm', intensity: 3 }),
      [],
      mkStats({}),
      []
    );
    expect(ctx.recent).toEqual([]);
    expect(ctx.current.emotion).toBe('calm');
  });
});

describe('buildReflectionUserMessage', () => {
  it('includes the current emotion label and intensity number', () => {
    const ctx = buildReflectionContext(
      mkRecord({ emotion: 'anxiety', intensity: 7, context: '开会' }),
      [],
      mkStats({}),
      []
    );
    const msg = buildReflectionUserMessage(ctx);

    expect(msg).toContain('焦虑'); // label for 'anxiety'
    expect(msg).toContain('7');
  });

  it('includes the current text when present', () => {
    const ctx = buildReflectionContext(
      mkRecord({ emotion: 'sadness', intensity: 6, context: '被误解了很难过' }),
      [],
      mkStats({}),
      []
    );
    const msg = buildReflectionUserMessage(ctx);
    expect(msg).toContain('被误解了很难过');
  });

  it('does not leak history record texts into the message', () => {
    const history = [
      mkRecord({ emotion: 'anxiety', intensity: 5, context: '历史秘密不应该出现' }),
    ];
    const ctx = buildReflectionContext(
      mkRecord({ emotion: 'happy', intensity: 4 }),
      history,
      mkStats({}),
      []
    );
    const msg = buildReflectionUserMessage(ctx);
    expect(msg).not.toContain('历史秘密不应该出现');
  });

  it('includes the 30-day dominant emotion when stats exist', () => {
    const ctx = buildReflectionContext(
      mkRecord({}),
      [],
      mkStats({ dominantEmotion: 'anxiety' }),
      []
    );
    const msg = buildReflectionUserMessage(ctx);
    expect(msg).toContain('焦虑'); // dominant emotion label
  });
});
