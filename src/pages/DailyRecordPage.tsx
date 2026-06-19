/**
 * DailyRecordPage — log a mood for the daily record loop (Issue #6 + #7).
 *
 * Lightweight, no-pressure daily logging: pick an emotion (10, incl. positive),
 * set intensity 1-10, optionally write a note. After submit, an AI reflection is
 * generated and archived to aiReflection (Issue #7). The reflection is single-shot
 * with structured routing options to chat/SOS — no multi-turn reply here.
 *
 * No streak / no "already logged today" blocking (weak-constraint diary model).
 * Today's records (with archived reflections) show at the bottom.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { DAILY_EMOTIONS } from '../lib/dailyRecord';
import {
  buildReflectionContext,
  resolveReflectionConfig,
  generateReflection,
  type ReflectionResult,
} from '../lib/dailyReflection';
import { computeStats, recentTrend } from '../lib/insights';
import type { EmotionRecord } from '../types/storage';

const INTENSITY_MIN = 1;
const INTENSITY_MAX = 10;
const NOTE_MAX_LENGTH = 1000;

function isToday(ts: number): boolean {
  const now = new Date();
  const d = new Date(ts);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const DailyRecordPage: React.FC = () => {
  const navigate = useNavigate();
  const emotionHistory = useAppStore((s) => s.emotionHistory);
  const addEmotionRecord = useAppStore((s) => s.addEmotionRecord);
  const updateEmotionRecord = useAppStore((s) => s.updateEmotionRecord);

  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reflection, setReflection] = useState<ReflectionResult | null>(null);
  const [reflectedRecord, setReflectedRecord] = useState<EmotionRecord | null>(null);

  const todayRecords = useMemo(
    () =>
      emotionHistory
        .filter((r) => r.source === 'daily' && isToday(r.timestamp))
        .sort((a, b) => b.timestamp - a.timestamp),
    [emotionHistory]
  );

  const canSubmit = selectedEmotion !== null && intensity !== null && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedEmotion || intensity === null) return;
    setSubmitting(true);
    try {
      const created = await addEmotionRecord({
        emotion: selectedEmotion,
        intensity,
        source: 'daily',
        context: note.trim() || undefined,
      });

      // Build the two-layer context and generate a one-shot reflection.
      const recent = emotionHistory.filter(
        (r) => r.source === 'daily' && r.id !== created.id
      );
      const monthStats = computeStats(emotionHistory, [], 'month');
      const trend = recentTrend(emotionHistory);
      const ctx = buildReflectionContext(created, recent, monthStats, trend);
      const resolved = resolveReflectionConfig();
      const result = await generateReflection(ctx, resolved);

      // Archive the reflection to the record.
      await updateEmotionRecord(created.id, { aiReflection: result.reflection });

      setReflection(result);
      setReflectedRecord(created);

      // reset the form, keep the page open for another entry (diary model)
      setSelectedEmotion(null);
      setIntensity(null);
      setNote('');
    } finally {
      setSubmitting(false);
    }
  };

  const emotionLabel = (key: string) => DAILY_EMOTIONS.find((e) => e.key === key)?.label ?? key;
  const emotionEmoji = (key: string) => DAILY_EMOTIONS.find((e) => e.key === key)?.emoji ?? '•';

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          今天感觉怎么样？
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          选一个情绪，记一笔。不写文字也可以。
        </p>
      </header>

      {/* emotion grid */}
      <section className="mb-6">
        <div className="grid grid-cols-5 gap-2">
          {DAILY_EMOTIONS.map((emotion) => {
            const isSelected = selectedEmotion === emotion.key;
            return (
              <motion.button
                key={emotion.key}
                onClick={() => setSelectedEmotion(emotion.key)}
                whileTap={{ scale: 0.92 }}
                className="flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all"
                style={{
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)',
                  backgroundColor: isSelected ? 'var(--bg-secondary)' : 'transparent',
                }}
                aria-pressed={isSelected}
              >
                <span className="text-2xl">{emotion.emoji}</span>
                <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                  {emotion.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* intensity scale 1-10 */}
      <section className="mb-6">
        <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          这种感受有多强烈？
        </h2>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: INTENSITY_MAX }, (_, i) => i + INTENSITY_MIN).map((n) => {
            const isSelected = intensity === n;
            return (
              <motion.button
                key={n}
                onClick={() => setIntensity(n)}
                whileTap={{ scale: 0.9 }}
                className="aspect-square rounded-xl border-2 text-sm font-medium transition-all"
                style={{
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)',
                  backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--text-primary)',
                }}
                aria-pressed={isSelected}
              >
                {n}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* optional note */}
      <section className="mb-6">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="想说点什么吗？不写也可以。"
          maxLength={NOTE_MAX_LENGTH}
          className="w-full p-3 rounded-2xl border resize-none text-sm"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
          rows={3}
        />
        <div className="text-right text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          {note.length}/{NOTE_MAX_LENGTH}
        </div>
      </section>

      {/* submit */}
      <motion.button
        onClick={handleSubmit}
        disabled={!canSubmit}
        whileTap={canSubmit ? { scale: 0.98 } : undefined}
        className="w-full py-3 rounded-2xl font-medium transition-opacity"
        style={{
          backgroundColor: canSubmit ? 'var(--accent)' : 'var(--border-color)',
          color: canSubmit ? '#fff' : 'var(--text-secondary)',
          opacity: canSubmit ? 1 : 0.6,
        }}
      >
        {submitting ? '正在回应你…' : '记下这一刻'}
      </motion.button>

      {/* AI reflection (single-shot, Issue #7) */}
      {reflection && reflectedRecord && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 rounded-2xl"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-primary)' }}>
            {reflection.reflection}
          </p>
          {reflection.fallback && (
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
              （这是一条本地占位回应，配置 API Key 后可获得 AI 专属回应）
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                navigate('/chat', {
                  state: {
                    seedMessage: reflectedRecord.context
                      ? `我今天记了${emotionLabel(reflectedRecord.emotion)}（强度${reflectedRecord.intensity}）：${reflectedRecord.context}`
                      : `我今天记了${emotionLabel(reflectedRecord.emotion)}，强度${reflectedRecord.intensity}`,
                  },
                })
              }
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              想再聊聊 →
            </button>
            <button
              onClick={() => navigate('/sos/emotion')}
              className="px-4 py-2 rounded-xl text-sm border-2"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              现在很难受
            </button>
            <button
              onClick={() => {
                setReflection(null);
                setReflectedRecord(null);
              }}
              className="px-4 py-2 rounded-xl text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              记下了，谢谢
            </button>
          </div>
        </motion.section>
      )}

      {/* today’s records */}
      {todayRecords.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            今天的记录 · {todayRecords.length} 条
          </h2>
          <ul className="space-y-2">
            {todayRecords.map((r) => (
              <li
                key={r.id}
                className="p-3 rounded-2xl border"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{emotionEmoji(r.emotion)}</span>
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                    {emotionLabel(r.emotion)}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                  >
                    强度 {r.intensity}
                  </span>
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(r.timestamp).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {r.context && (
                  <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                    {r.context}
                  </p>
                )}
                {r.aiReflection && (
                  <p className="text-xs italic mt-1" style={{ color: 'var(--text-secondary)' }}>
                    AI：{r.aiReflection}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default DailyRecordPage;
