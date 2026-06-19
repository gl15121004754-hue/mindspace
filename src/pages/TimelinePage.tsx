/**
 * TimelinePage — review past daily mood records, grouped by day (Issue #11).
 *
 * Complements InsightPage: InsightPage = aggregates/statistics, TimelinePage =
 * detail review. Each day is a header (zh-CN long-month + numeric-day) with the
 * day's record count; records render compactly (emoji + label + intensity
 * badge). Clicking a record toggles its `aiReflection` (and `context`) inline —
 * collapsed by default to keep the review calm and skimmable.
 *
 * Only daily records are shown. `resolveSource` backfills legacy records that
 * predate the explicit `source` field (defaults to 'daily').
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { DAILY_EMOTIONS, resolveSource } from '../lib/dailyRecord';
import type { EmotionRecord } from '../types/storage';

/** Local-time YYYY-MM-DD key for grouping a record into its calendar day. */
function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "6月19日" style header — local time, long month + numeric day. */
function dayHeaderLabel(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

interface DayGroup {
  key: string;
  /** A representative timestamp (the newest record's) for sorting + header. */
  anchorTs: number;
  records: EmotionRecord[];
}

const TimelinePage: React.FC = () => {
  const emotionHistory = useAppStore((s) => s.emotionHistory);
  // expanded state is tracked per-record by id
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const dailyGroups = useMemo<DayGroup[]>(() => {
    // 1. keep only daily records (resolveSource backfills legacy records)
    const daily = emotionHistory.filter((r) => resolveSource(r) === 'daily');

    // 2. group by local calendar day
    const byDay = new Map<string, EmotionRecord[]>();
    for (const r of daily) {
      const k = dayKey(r.timestamp);
      const list = byDay.get(k);
      if (list) list.push(r);
      else byDay.set(k, [r]);
    }

    // 3. within each day, sort newest-first; anchor the group on the newest ts
    const groups: DayGroup[] = [];
    for (const [key, records] of byDay) {
      const sorted = records.slice().sort((a, b) => b.timestamp - a.timestamp);
      groups.push({ key, anchorTs: sorted[0].timestamp, records: sorted });
    }

    // 4. days themselves newest-first
    groups.sort((a, b) => b.anchorTs - a.anchorTs);
    return groups;
  }, [emotionHistory]);

  const emotionLabel = (key: string) =>
    DAILY_EMOTIONS.find((e) => e.key === key)?.label ?? key;
  const emotionEmoji = (key: string) =>
    DAILY_EMOTIONS.find((e) => e.key === key)?.emoji ?? '•';

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // --- Empty state ---------------------------------------------------------
  if (dailyGroups.length === 0) {
    return (
      <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            心情记录
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            回看每一天的记录与回应。
          </p>
        </header>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-2xl"
          style={{ backgroundColor: 'var(--bg-card)' }}
        >
          <div
            className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <span className="text-4xl">🌿</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            还没有记录。去记一笔心情吧。
          </p>
        </motion.div>
      </div>
    );
  }

  // --- Day-grouped timeline ------------------------------------------------
  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          心情记录
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          回看每一天的记录与回应。
        </p>
      </header>

      <div className="space-y-6">
        {dailyGroups.map((group) => (
          <motion.section
            key={group.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* day header + count */}
            <div className="flex items-baseline gap-2 mb-3">
              <h2
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {dayHeaderLabel(group.anchorTs)}
              </h2>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                · {group.records.length} 条
              </span>
            </div>

            {/* records for this day */}
            <ul className="space-y-2">
              {group.records.map((r) => {
                const isOpen = !!expanded[r.id];
                return (
                  <li
                    key={r.id}
                    className="rounded-2xl border overflow-hidden"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    {/* compact row (clickable to expand/collapse) */}
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      aria-expanded={isOpen}
                      className="w-full text-left p-3 flex items-center gap-2"
                    >
                      <span className="text-xl">{emotionEmoji(r.emotion)}</span>
                      <span
                        className="font-medium text-sm"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {emotionLabel(r.emotion)}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        强度 {r.intensity}
                      </span>
                      <span
                        className="text-xs ml-auto"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {new Date(r.timestamp).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-hidden
                      >
                        {isOpen ? '▾' : '▸'}
                      </span>
                    </button>

                    {/* expanded detail: context + aiReflection.
                        y-offset only (no opacity/height) so the content stays
                        queryable as visible in tests and animates gently. */}
                    {isOpen && (
                      <motion.div
                        initial={{ y: -6 }}
                        animate={{ y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-3 pb-3 space-y-2"
                      >
                        {r.context && (
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {r.context}
                          </p>
                        )}
                        {r.aiReflection && (
                          <p
                            className="text-xs italic"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            AI：{r.aiReflection}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.section>
        ))}
      </div>
    </div>
  );
};

export default TimelinePage;
