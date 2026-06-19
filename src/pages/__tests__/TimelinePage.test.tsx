/**
 * Component tests for TimelinePage — the "review past records" surface for
 * Issue #11. Records are grouped by day (newest first), collapsed by default
 * with emotion emoji/label/intensity, and expandable to reveal aiReflection +
 * optional context. Pure detail view — no statistics/aggregates (that's
 * InsightPage's job).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TimelinePage from '../TimelinePage';
import type { EmotionRecord } from '../../types/storage';

// --- Mock useAppStore ------------------------------------------------------
// TimelinePage reads emotionHistory via a selector. We mock the store with a
// selector-supporting stub so we can control the returned records per test.

type StoreLike = {
  emotionHistory: EmotionRecord[];
};

const { storeState } = vi.hoisted(() => ({
  storeState: {
    emotionHistory: [] as EmotionRecord[],
  } as StoreLike,
}));

vi.mock('../../store/useAppStore', () => ({
  useAppStore: Object.assign(
    vi.fn((selector?: (s: StoreLike) => unknown) =>
      typeof selector === 'function' ? selector(storeState) : storeState
    ),
    {
      getState: () => storeState,
      setState: (partial: Partial<StoreLike>) => Object.assign(storeState, partial),
    }
  ),
}));

const renderWithRouter = (component: React.ReactNode) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

// Helpers to build records on specific local-time days.
// We anchor timestamps to local midnight +/- hours to guarantee same/different
// day groups regardless of the test runner's timezone.
function atLocalDay(year: number, monthIndex: number, day: number, hour = 12, minute = 0): number {
  return new Date(year, monthIndex, day, hour, minute, 0).getTime();
}

describe('TimelinePage', () => {
  beforeEach(() => {
    storeState.emotionHistory = [];
  });

  it('shows the empty message when there are no daily records, without crashing', () => {
    renderWithRouter(<TimelinePage />);
    expect(screen.getByText(/还没有记录/i)).toBeInTheDocument();
  });

  it('shows the empty message when only non-daily (sos) records exist', () => {
    storeState.emotionHistory = [
      {
        id: 'sos-1',
        emotion: 'anxiety',
        intensity: 9,
        timestamp: atLocalDay(2026, 5, 19),
        source: 'sos',
      },
    ];
    renderWithRouter(<TimelinePage />);
    expect(screen.getByText(/还没有记录/i)).toBeInTheDocument();
  });

  it('groups multiple same-day records under one day header with a count', () => {
    storeState.emotionHistory = [
      {
        id: 'r1',
        emotion: 'anxiety',
        intensity: 6,
        timestamp: atLocalDay(2026, 5, 19, 9),
        source: 'daily',
      },
      {
        id: 'r2',
        emotion: 'happy',
        intensity: 8,
        timestamp: atLocalDay(2026, 5, 19, 18),
        source: 'daily',
      },
    ];
    renderWithRouter(<TimelinePage />);

    // both records visible
    expect(screen.getByText('焦虑')).toBeInTheDocument();
    expect(screen.getByText('开心')).toBeInTheDocument();
    // count surfaced for the single day
    expect(screen.getByText(/2\s*条/)).toBeInTheDocument();
  });

  it('renders separate day groups, newest day first', () => {
    const olderDay = atLocalDay(2026, 5, 10, 9);
    const newerDay = atLocalDay(2026, 5, 19, 9);
    storeState.emotionHistory = [
      { id: 'old', emotion: 'sadness', intensity: 4, timestamp: olderDay, source: 'daily' },
      { id: 'new', emotion: 'calm', intensity: 5, timestamp: newerDay, source: 'daily' },
    ];
    const { container } = renderWithRouter(<TimelinePage />);

    // both records render
    expect(screen.getByText('悲伤')).toBeInTheDocument();
    expect(screen.getByText('平静')).toBeInTheDocument();

    // newest day header appears before the older day header in document order
    const newHeader = screen.getByText('6月19日');
    const oldHeader = screen.getByText('6月10日');
    const newIndex = Array.from(container.querySelectorAll('*')).indexOf(newHeader);
    const oldIndex = Array.from(container.querySelectorAll('*')).indexOf(oldHeader);
    expect(newIndex).toBeGreaterThan(-1);
    expect(oldIndex).toBeGreaterThan(-1);
    expect(newIndex).toBeLessThan(oldIndex);
  });

  it('within a day, sorts records newest-first', () => {
    storeState.emotionHistory = [
      { id: 'early', emotion: 'anxiety', intensity: 6, timestamp: atLocalDay(2026, 5, 19, 8), source: 'daily' },
      { id: 'late', emotion: 'happy', intensity: 8, timestamp: atLocalDay(2026, 5, 19, 20), source: 'daily' },
    ];
    const { container } = renderWithRouter(<TimelinePage />);

    // happy (late) should appear before anxiety (early)
    const happy = screen.getByText('开心');
    const anxiety = screen.getByText('焦虑');
    const happyIdx = Array.from(container.querySelectorAll('*')).indexOf(happy);
    const anxietyIdx = Array.from(container.querySelectorAll('*')).indexOf(anxiety);
    expect(happyIdx).toBeLessThan(anxietyIdx);
  });

  it('is collapsed by default: shows emoji/label/intensity but NOT the aiReflection', () => {
    storeState.emotionHistory = [
      {
        id: 'r1',
        emotion: 'anxiety',
        intensity: 6,
        timestamp: atLocalDay(2026, 5, 19),
        source: 'daily',
        context: '今天开会压力很大',
        aiReflection: '我感受到你今天的压力，这一刻被看见了。',
      },
    ];
    renderWithRouter(<TimelinePage />);

    // compact info present
    expect(screen.getByText('焦虑')).toBeInTheDocument();
    expect(screen.getByText('强度 6')).toBeInTheDocument();
    // aiReflection hidden by default
    expect(screen.queryByText(/我感受到你今天的压力，这一刻被看见了。/)).not.toBeInTheDocument();
  });

  it('expands to show aiReflection (and context) when the record row is clicked', () => {
    storeState.emotionHistory = [
      {
        id: 'r1',
        emotion: 'anxiety',
        intensity: 6,
        timestamp: atLocalDay(2026, 5, 19),
        source: 'daily',
        context: '今天开会压力很大',
        aiReflection: '我感受到你今天的压力，这一刻被看见了。',
      },
    ];
    renderWithRouter(<TimelinePage />);

    // initially hidden
    expect(screen.queryByText(/我感受到你今天的压力，这一刻被看见了。/)).not.toBeInTheDocument();

    // click the row to expand — target via the record's emotion label
    fireEvent.click(screen.getByText('焦虑'));

    // reflection + context now visible (reflection is prefixed with "AI：")
    expect(screen.getByText(/我感受到你今天的压力，这一刻被看见了。/)).toBeInTheDocument();
    expect(screen.getByText('今天开会压力很大')).toBeInTheDocument();
  });

  it('collapses again when clicked a second time (aiReflection hidden)', () => {
    storeState.emotionHistory = [
      {
        id: 'r1',
        emotion: 'anxiety',
        intensity: 6,
        timestamp: atLocalDay(2026, 5, 19),
        source: 'daily',
        aiReflection: '我感受到你今天的压力，这一刻被看见了。',
      },
    ];
    renderWithRouter(<TimelinePage />);

    // expand
    fireEvent.click(screen.getByText('焦虑'));
    expect(screen.getByText(/我感受到你今天的压力，这一刻被看见了。/)).toBeInTheDocument();

    // collapse
    fireEvent.click(screen.getByText('焦虑'));
    expect(screen.queryByText(/我感受到你今天的压力，这一刻被看见了。/)).not.toBeInTheDocument();
  });

  it('tracks expanded state per-record (expanding one does not expand another)', () => {
    storeState.emotionHistory = [
      {
        id: 'r1',
        emotion: 'anxiety',
        intensity: 6,
        timestamp: atLocalDay(2026, 5, 19, 9),
        source: 'daily',
        aiReflection: 'reflection-one',
      },
      {
        id: 'r2',
        emotion: 'happy',
        intensity: 8,
        timestamp: atLocalDay(2026, 5, 19, 18),
        source: 'daily',
        aiReflection: 'reflection-two',
      },
    ];
    renderWithRouter(<TimelinePage />);

    // expand only the anxiety record
    fireEvent.click(screen.getByText('焦虑'));
    expect(screen.getByText(/reflection-one/)).toBeInTheDocument();
    expect(screen.queryByText(/reflection-two/)).not.toBeInTheDocument();
  });

  it('backfills old records without a source field as daily via resolveSource', () => {
    // Old record: no `source`. resolveSource should treat it as 'daily'.
    storeState.emotionHistory = [
      {
        id: 'legacy',
        emotion: 'sadness',
        intensity: 5,
        timestamp: atLocalDay(2026, 5, 18),
        // source intentionally omitted
      },
    ];
    renderWithRouter(<TimelinePage />);

    // the legacy record is shown as a daily record
    expect(screen.getByText('悲伤')).toBeInTheDocument();
    // it contributed to a day count of 1
    expect(screen.getByText(/1\s*条/)).toBeInTheDocument();
  });

  it('does not render statistics (no averages, distributions, or aggregates)', () => {
    storeState.emotionHistory = [
      { id: 'r1', emotion: 'anxiety', intensity: 6, timestamp: atLocalDay(2026, 5, 19), source: 'daily' },
      { id: 'r2', emotion: 'happy', intensity: 8, timestamp: atLocalDay(2026, 5, 19), source: 'daily' },
      { id: 'r3', emotion: 'calm', intensity: 4, timestamp: atLocalDay(2026, 5, 10), source: 'daily' },
    ];
    renderWithRouter(<TimelinePage />);

    // InsightPage-style stats wording must not appear
    expect(screen.queryByText(/平均.*强度/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/情绪.*分布/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/主导.*情绪/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/最近.*趋势/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/对话次数/)).not.toBeInTheDocument();
  });
});
