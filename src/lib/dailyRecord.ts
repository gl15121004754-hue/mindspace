/**
 * Daily Record domain logic.
 *
 * See CONTEXT.md and ADR-0001/0003 for the product rationale:
 * - The daily-record emotion set MUST include positive emotions (calm/happy/
 *   gratitude/relax); an all-negative set would amplify rumination.
 * - `source` is an explicit field replacing the legacy `copingMethod?.includes('sos')`
 *   string match (insights.ts). Old records are backfilled via `resolveSource`.
 */

import type { EmotionRecord } from '../types/storage';

/** Canonical emotion type for an EmotionRecord. */
export type EmotionKey =
  // negative (shared with SOS)
  | 'anxiety'
  | 'anger'
  | 'sadness'
  | 'panic'
  | 'overwhelm'
  | 'exhaustion'
  // positive (daily-only)
  | 'calm'
  | 'happy'
  | 'gratitude'
  | 'relax';

export interface EmotionOption {
  key: EmotionKey;
  emoji: string;
  label: string;
}

/** The 4 positive emotion keys — daily records only, never in SOS. */
export const POSITIVE_EMOTIONS: EmotionKey[] = ['calm', 'happy', 'gratitude', 'relax'];

/**
 * The full emotion set available to daily records: 6 negative + 4 positive.
 * Negative emotions mirror SOS; positive emotions are daily-only.
 */
export const DAILY_EMOTIONS: EmotionOption[] = [
  { key: 'anxiety', emoji: '😰', label: '焦虑' },
  { key: 'anger', emoji: '😠', label: '愤怒' },
  { key: 'sadness', emoji: '😢', label: '悲伤' },
  { key: 'panic', emoji: '😨', label: '惊恐' },
  { key: 'overwhelm', emoji: '🤯', label: '过载' },
  { key: 'exhaustion', emoji: '😴', label: '疲惫' },
  { key: 'calm', emoji: '😌', label: '平静' },
  { key: 'happy', emoji: '🙂', label: '开心' },
  { key: 'gratitude', emoji: '🙏', label: '感激' },
  { key: 'relax', emoji: '🍃', label: '放松' },
];

/** SOS-only subset: the 6 negative emotions. */
export const SOS_EMOTIONS: EmotionOption[] = DAILY_EMOTIONS.filter(
  (e) => !POSITIVE_EMOTIONS.includes(e.key)
);

/** True for the 4 positive emotion keys. */
export function isPositiveEmotion(key: string): boolean {
  return (POSITIVE_EMOTIONS as string[]).includes(key);
}

/**
 * Resolve the source of an EmotionRecord, backfilling legacy records that
 * predate the `source` field.
 *
 * Priority:
 * 1. explicit `source` field
 * 2. legacy `copingMethod` containing "sos" (matches insights.ts convention)
 * 3. default to 'daily'
 */
export function resolveSource(record: Pick<EmotionRecord, 'source' | 'copingMethod'>): 'daily' | 'sos' | 'chat' {
  if (record.source) return record.source;
  if (record.copingMethod?.includes('sos')) return 'sos';
  return 'daily';
}
