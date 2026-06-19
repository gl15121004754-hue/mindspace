/**
 * HomePage — the daily-first homepage (Issue #10).
 *
 * Issue #10 redefines the homepage: daily recording becomes the primary entry,
 * with SOS demoted to a clear but secondary button (see ADR-0002 retention
 * strategy). The main CTA is "今天感觉怎么样？" → /daily-record.
 *
 * Layout (top to bottom):
 *   - theme toggle (top-right, unchanged logic from the old homepage)
 *   - MindSpace logo + calm greeting
 *   - 今日卡片 (only when a daily record exists today): the most recent
 *     today's daily record — emoji + label + intensity + aiReflection summary
 *   - primary CTA "今天感觉怎么样？" → /daily-record (accent, full-width)
 *   - secondary entry "看看过去的我 →" → /timeline
 *   - demoted SOS button "现在很难受？→ 立即急救" → /sos/emotion (outline style)
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { useAppStore } from '../store/useAppStore';
import { DAILY_EMOTIONS } from '../lib/dailyRecord';
import type { EmotionRecord } from '../types/storage';

/** True when `ts` falls on the same calendar day (local) as now. */
function isToday(ts: number): boolean {
  const now = new Date();
  const d = new Date(ts);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const emotionHistory = useAppStore((s) => s.emotionHistory);

  // Most recent daily record logged today (if any). Drives the 今日卡片.
  const todaysDaily = useMemo<EmotionRecord | null>(() => {
    const today = emotionHistory
      .filter((r) => r.source === 'daily' && isToday(r.timestamp))
      .sort((a, b) => b.timestamp - a.timestamp);
    return today[0] ?? null;
  }, [emotionHistory]);

  const emotionOption = (key: string) => DAILY_EMOTIONS.find((e) => e.key === key);
  const emotionLabel = (key: string) => emotionOption(key)?.label ?? key;
  const emotionEmoji = (key: string) => emotionOption(key)?.emoji ?? '•';

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 py-10 relative transition-colors"
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      {/* theme toggle (top-right, reused logic) */}
      <motion.button
        onClick={toggleTheme}
        aria-label="切换主题"
        className="absolute top-6 right-6 p-3 rounded-full transition-all hover:scale-105"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
        whileTap={{ scale: 0.95 }}
      >
        {theme === 'light' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
      </motion.button>

      {/* Logo + calm greeting */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-xl bg-gradient-to-br from-purple-400 to-pink-500">
          <span className="text-3xl text-white font-bold">M</span>
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          MindSpace
        </h1>
        <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
          慢慢来，这里有一刻属于你。
        </p>
      </motion.div>

      <div className="w-full max-w-sm flex flex-col gap-5">
        {/* 今日卡片 — only when a daily record exists today */}
        {todaysDaily && (
          <motion.section
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="p-4 rounded-2xl border"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              今日卡片
            </p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{emotionEmoji(todaysDaily.emotion)}</span>
              <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                {emotionLabel(todaysDaily.emotion)}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
              >
                强度 {todaysDaily.intensity}
              </span>
            </div>
            {todaysDaily.aiReflection && (
              <p className="text-sm leading-relaxed italic" style={{ color: 'var(--text-secondary)' }}>
                {todaysDaily.aiReflection}
              </p>
            )}
          </motion.section>
        )}

        {/* PRIMARY CTA — daily record (visual focus) */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onClick={() => navigate('/daily-record')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex flex-col items-center justify-center gap-1 font-semibold text-white rounded-2xl transition-all"
          style={{
            backgroundColor: 'var(--accent)',
            boxShadow: '0 10px 30px -8px var(--accent)',
            padding: '1.5rem 2rem',
            fontSize: '1.25rem',
          }}
        >
          <span>今天感觉怎么样？</span>
          <span className="text-sm font-normal opacity-90">点一下，记一笔心情</span>
          <motion.span
            className="arrow-right"
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            →
          </motion.span>
        </motion.button>

        {/* timeline entry */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          onClick={() => navigate('/timeline')}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 font-medium rounded-2xl transition-all"
          style={{
            color: 'var(--text-primary)',
            backgroundColor: 'transparent',
            border: '1px solid var(--border-color)',
            padding: '0.9rem 1.5rem',
            fontSize: '0.95rem',
          }}
        >
          看看过去的我 →
        </motion.button>

        {/* SOS — demoted to secondary (outline style, smaller than daily CTA) */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          onClick={() => navigate('/sos/emotion')}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 font-medium rounded-2xl transition-all"
          style={{
            color: 'var(--accent)',
            backgroundColor: 'transparent',
            border: '2px solid var(--accent)',
            padding: '0.75rem 1.5rem',
            fontSize: '0.9rem',
          }}
        >
          现在很难受？→ 立即急救
        </motion.button>
      </div>
    </div>
  );
};

export default HomePage;
