/**
 * Unit tests for lib/insights — the pure statistics module extracted from
 * InsightPage. These exercise the computation directly; before the extraction
 * this logic was untestable without rendering the page component.
 */

import { describe, it, expect } from 'vitest';
import {
  computeStats,
  emotionDistribution,
  intensityDistribution,
  recentTrend,
  rangeCutoff,
} from '../insights';
import type { EmotionRecord } from '../../types/storage';
import type { Conversation } from '../../types';

const NOW = new Date('2026-06-19T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

const mkEmotion = (over: Partial<EmotionRecord>): EmotionRecord => ({
  id: `e_${Math.random().toString(36).slice(2)}`,
  emotion: 'anxiety',
  intensity: 5,
  timestamp: NOW,
  ...over,
});

const mkConversation = (over: Partial<Conversation>): Conversation => ({
  id: `c_${Math.random().toString(36).slice(2)}`,
  messages: [],
  startTime: NOW,
  ...over,
});

describe('rangeCutoff', () => {
  it('week = 7 days back', () => {
    expect(rangeCutoff('week', NOW)).toBe(NOW - 7 * DAY);
  });
  it('month = 30 days back', () => {
    expect(rangeCutoff('month', NOW)).toBe(NOW - 30 * DAY);
  });
});

describe('computeStats', () => {
  it('returns null when there is no data at all', () => {
    expect(computeStats([], [], 'week', NOW)).toBeNull();
  });

  it('filters out records older than the range', () => {
    const emotions = [
      mkEmotion({ intensity: 8, timestamp: NOW - 1 * DAY }), // in
      mkEmotion({ intensity: 2, timestamp: NOW - 20 * DAY }), // out (week)
    ];
    const stats = computeStats(emotions, [], 'week', NOW)!;

    expect(stats.totalEmotions).toBe(1);
    expect(stats.avgIntensity).toBe(8);
  });

  it('counts messages across conversations in range', () => {
    const conversations = [
      mkConversation({
        startTime: NOW - 1 * DAY,
        messages: [
          { id: 'm1', role: 'user', content: 'a', timestamp: NOW },
          { id: 'm2', role: 'assistant', content: 'b', timestamp: NOW },
        ],
      }),
      mkConversation({ startTime: NOW, messages: [{ id: 'm3', role: 'user', content: 'c', timestamp: NOW }] }),
    ];
    const stats = computeStats([], conversations, 'week', NOW)!;

    expect(stats.totalConversations).toBe(2);
    expect(stats.totalMessages).toBe(3);
  });

  it('picks the most frequent emotion as dominant', () => {
    const emotions = [
      mkEmotion({ emotion: 'sadness', timestamp: NOW }),
      mkEmotion({ emotion: 'anxiety', timestamp: NOW }),
      mkEmotion({ emotion: 'anxiety', timestamp: NOW }),
    ];
    const stats = computeStats(emotions, [], 'week', NOW)!;

    expect(stats.dominantEmotion).toBe('anxiety');
  });

  it('averages effectiveness only over SOS records', () => {
    const emotions = [
      mkEmotion({ copingMethod: 'sos-first-aid', effectiveness: 4, timestamp: NOW }),
      mkEmotion({ copingMethod: 'sos-first-aid', effectiveness: 5, timestamp: NOW }),
      mkEmotion({ copingMethod: 'other', effectiveness: 1, timestamp: NOW }),
    ];
    const stats = computeStats(emotions, [], 'week', NOW)!;

    expect(stats.sosCount).toBe(2);
    // (4+5)/2 = 4.5
    expect(stats.avgEffectiveness).toBe(4.5);
  });

  it('rounds avgIntensity to one decimal', () => {
    const emotions = [
      mkEmotion({ intensity: 3, timestamp: NOW }),
      mkEmotion({ intensity: 4, timestamp: NOW }),
      mkEmotion({ intensity: 4, timestamp: NOW }),
    ];
    const stats = computeStats(emotions, [], 'week', NOW)!;

    // (3+4+4)/3 = 3.666... -> 3.7
    expect(stats.avgIntensity).toBe(3.7);
  });
});

describe('emotionDistribution', () => {
  const labels = { anxiety: { label: '焦虑' }, sadness: { label: '悲伤' } };
  const colors = { anxiety: '#F59E0B', sadness: '#3B82F6' };

  it('groups counts per emotion and maps to display label + color', () => {
    const emotions = [
      mkEmotion({ emotion: 'anxiety', timestamp: NOW }),
      mkEmotion({ emotion: 'anxiety', timestamp: NOW }),
      mkEmotion({ emotion: 'sadness', timestamp: NOW }),
    ];
    const dist = emotionDistribution(emotions, 'week', labels, colors, NOW);

    expect(dist).toHaveLength(2);
    const anxiety = dist.find((d) => d.emotion === 'anxiety')!;
    expect(anxiety.value).toBe(2);
    expect(anxiety.name).toBe('焦虑');
    expect(anxiety.color).toBe('#F59E0B');
  });

  it('falls back to the raw key for unknown emotions', () => {
    const dist = emotionDistribution(
      [mkEmotion({ emotion: 'mystery', timestamp: NOW })],
      'week',
      labels,
      colors,
      NOW
    );
    expect(dist[0].name).toBe('mystery');
    expect(dist[0].color).toBe('#6B7280');
  });
});

describe('intensityDistribution', () => {
  it('buckets intensities into the 4 ranges', () => {
    const emotions = [
      mkEmotion({ intensity: 2, timestamp: NOW }), // 1-3
      mkEmotion({ intensity: 5, timestamp: NOW }), // 4-6
      mkEmotion({ intensity: 5, timestamp: NOW }), // 4-6
      mkEmotion({ intensity: 8, timestamp: NOW }), // 7-8
      mkEmotion({ intensity: 10, timestamp: NOW }), // 9-10
    ];
    const buckets = intensityDistribution(emotions, 'week', NOW);
    const byRange = Object.fromEntries(buckets.map((b) => [b.range, b.count]));

    expect(byRange['1-3 轻微']).toBe(1);
    expect(byRange['4-6 中等']).toBe(2);
    expect(byRange['7-8 严重']).toBe(1);
    expect(byRange['9-10 极度']).toBe(1);
  });
});

describe('recentTrend', () => {
  it('always returns exactly 7 days, oldest first', () => {
    const trend = recentTrend([], NOW);
    expect(trend).toHaveLength(7);
    // first entry is 6 days ago, last is today
    expect(trend[0].date).toContain('6月13日');
    expect(trend[6].date).toContain('6月19日');
  });

  it('accumulates a rolling average intensity per day', () => {
    const emotions = [
      mkEmotion({ intensity: 4, timestamp: NOW }), // today
      mkEmotion({ intensity: 6, timestamp: NOW }), // today -> avg 5
      mkEmotion({ intensity: 8, timestamp: NOW - 1 * DAY }), // yesterday
    ];
    const trend = recentTrend(emotions, NOW);

    expect(trend[6].count).toBe(2);
    expect(trend[6].avgIntensity).toBe(5);
    expect(trend[5].count).toBe(1);
    expect(trend[5].avgIntensity).toBe(8);
  });

  it('ignores records outside the trailing week', () => {
    const emotions = [mkEmotion({ intensity: 9, timestamp: NOW - 10 * DAY })];
    const trend = recentTrend(emotions, NOW);

    expect(trend.every((d) => d.count === 0)).toBe(true);
  });
});
