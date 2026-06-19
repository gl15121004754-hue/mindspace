/**
 * Insight statistics — pure functions, no React/DOM dependency.
 *
 * Extracted from InsightPage so the computation is testable through a small
 * interface (the page used to hold ~120 lines of pure data-crunching inside
 * useEffect/useMemo, untestable without rendering the component).
 *
 * All functions take the already-loaded emotion + conversation records and a
 * time range, and return derived data. No side effects, no Date.now() at
 * module load (taken as a param or computed once inside the entry point).
 */

import type { EmotionRecord } from '../types/storage';
import type { Conversation } from '../types';

export type TimeRange = 'week' | 'month';

export interface InsightStats {
  totalEmotions: number;
  totalConversations: number;
  totalMessages: number;
  avgIntensity: number;
  dominantEmotion: string;
  sosCount: number;
  avgEffectiveness: number;
}

export interface EmotionSlice {
  emotion: string;   // raw emotion key (e.g. 'anxiety')
  name: string;      // display label
  value: number;
  color: string;
}

export interface IntensityBucket {
  range: string;
  count: number;
  color: string;
}

export interface TrendDay {
  date: string;       // display key, e.g. '6月18日'
  avgIntensity: number;
  count: number;
}

/** Cutoff timestamp for a time range, relative to `now`. */
export function rangeCutoff(range: TimeRange, now = Date.now()): number {
  const days = range === 'week' ? 7 : 30;
  return now - days * 24 * 60 * 60 * 1000;
}

/**
 * Overview stats for the selected time range.
 */
export function computeStats(
  emotions: EmotionRecord[],
  conversations: Conversation[],
  range: TimeRange,
  now = Date.now()
): InsightStats | null {
  if (conversations.length === 0 && emotions.length === 0) return null;

  const cutoff = rangeCutoff(range, now);
  const filteredEmotions = emotions.filter((e) => e.timestamp >= cutoff);
  const filteredConversations = conversations.filter((c) => c.startTime >= cutoff);

  const totalMessages = filteredConversations.reduce(
    (acc, conv) => acc + conv.messages.length,
    0
  );

  const avgIntensity =
    filteredEmotions.length > 0
      ? filteredEmotions.reduce((acc, e) => acc + (e.intensity || 0), 0) / filteredEmotions.length
      : 0;

  const emotionCount: Record<string, number> = {};
  filteredEmotions.forEach((e) => {
    const key = e.emotion || '未知情绪';
    emotionCount[key] = (emotionCount[key] || 0) + 1;
  });
  const dominantEmotion =
    Object.entries(emotionCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '无数据';

  const sosRecords = filteredEmotions.filter((e) => e.copingMethod?.includes('sos'));
  const avgEffectiveness =
    sosRecords.length > 0
      ? sosRecords.reduce((acc, e) => acc + (e.effectiveness || 0), 0) / sosRecords.length
      : 0;

  return {
    totalEmotions: filteredEmotions.length,
    totalConversations: filteredConversations.length,
    totalMessages,
    avgIntensity: Math.round(avgIntensity * 10) / 10,
    dominantEmotion,
    sosCount: sosRecords.length,
    avgEffectiveness: Math.round(avgEffectiveness * 10) / 10,
  };
}

/**
 * Emotion-type distribution for the pie chart.
 * `labels`/`colors` map the raw emotion key to display values.
 */
export function emotionDistribution(
  emotions: EmotionRecord[],
  range: TimeRange,
  labels: Record<string, { label: string }>,
  colors: Record<string, string>,
  now = Date.now()
): EmotionSlice[] {
  const cutoff = rangeCutoff(range, now);
  const filtered = emotions.filter((e) => e.timestamp >= cutoff);

  const distribution: Record<string, number> = {};
  filtered.forEach((e) => {
    const key = e.emotion || '未知情绪';
    distribution[key] = (distribution[key] || 0) + 1;
  });

  return Object.entries(distribution).map(([emotion, value]) => ({
    emotion,
    name: labels[emotion]?.label || emotion,
    value,
    color: colors[emotion] || '#6B7280',
  }));
}

/**
 * Intensity distribution bucketed: 1-3 轻微, 4-6 中等, 7-8 严重, 9-10 极度.
 */
export function intensityDistribution(
  emotions: EmotionRecord[],
  range: TimeRange,
  now = Date.now()
): IntensityBucket[] {
  const cutoff = rangeCutoff(range, now);
  const filtered = emotions.filter((e) => e.timestamp >= cutoff);

  const buckets: IntensityBucket[] = [
    { range: '1-3 轻微', count: 0, color: '#10B981' },
    { range: '4-6 中等', count: 0, color: '#F59E0B' },
    { range: '7-8 严重', count: 0, color: '#EF4444' },
    { range: '9-10 极度', count: 0, color: '#8B5CF6' },
  ];

  filtered.forEach((e) => {
    const intensity = e.intensity || 0;
    if (intensity <= 3) buckets[0].count++;
    else if (intensity <= 6) buckets[1].count++;
    else if (intensity <= 8) buckets[2].count++;
    else buckets[3].count++;
  });

  return buckets;
}

/**
 * Last 7 days trend (always 7 entries, oldest first), with rolling-average
 * intensity per day. Ignores the selected range — always the trailing week.
 */
export function recentTrend(emotions: EmotionRecord[], now = Date.now()): TrendDay[] {
  const days: Record<string, TrendDay> = {};

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateKey = `${date.getMonth() + 1}月${date.getDate()}日`;
    days[dateKey] = { date: dateKey, avgIntensity: 0, count: 0 };
  }

  emotions.forEach((e) => {
    const date = new Date(e.timestamp);
    const dateKey = `${date.getMonth() + 1}月${date.getDate()}日`;
    const day = days[dateKey];
    if (day) {
      day.avgIntensity = (day.avgIntensity * day.count + e.intensity) / (day.count + 1);
      day.count++;
    }
  });

  return Object.values(days);
}
