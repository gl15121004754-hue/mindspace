/**
 * Component tests for HomePage — the daily-first homepage (Issue #10).
 *
 * Issue #10 makes daily recording the primary entry and demotes SOS to a
 * secondary button (ADR-0002 retention strategy). We assert external behavior
 * only: what renders and where each entry navigates.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import HomePage from '../HomePage';
import type { EmotionRecord } from '../../types/storage';

// --- Mock navigate (kept partial so BrowserRouter stays available) ----------
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// --- Mock useThemeStore ----------------------------------------------------
vi.mock('../../store/themeStore', () => ({
  useThemeStore: () => ({ theme: 'light' as const, toggleTheme: vi.fn() }),
}));

// --- Mock useAppStore (selector-supporting, mirrors DailyRecordPage.test) ---
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

const makeRecord = (over: Partial<EmotionRecord>): EmotionRecord => ({
  id: 'r-1',
  emotion: 'anxiety',
  intensity: 6,
  timestamp: Date.now(),
  source: 'daily',
  ...over,
});

describe('HomePage (Issue #10 — daily-first)', () => {
  beforeEach(() => {
    storeState.emotionHistory = [];
    navigateMock.mockReset();
  });

  it('renders "今天感觉怎么样？" as the primary text', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText('今天感觉怎么样？')).toBeInTheDocument();
  });

  it('renders the daily-record entry that navigates to /daily-record', async () => {
    const user = userEvent.setup();
    renderWithRouter(<HomePage />);
    const cta = screen.getByRole('button', { name: /今天感觉怎么样/ });
    await user.click(cta);
    expect(navigateMock).toHaveBeenCalledWith('/daily-record');
  });

  it('renders the SOS secondary button (contains 很难受 / 急救)', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByRole('button', { name: /很难受|急救/ })).toBeInTheDocument();
  });

  it('navigates to /sos/emotion from the SOS secondary button', async () => {
    const user = userEvent.setup();
    renderWithRouter(<HomePage />);
    await user.click(screen.getByRole('button', { name: /很难受|急救/ }));
    expect(navigateMock).toHaveBeenCalledWith('/sos/emotion');
  });

  it('renders the "看看过去的我" timeline entry', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByRole('button', { name: /看看过去的我/ })).toBeInTheDocument();
  });

  it('navigates to /timeline from the timeline entry', async () => {
    const user = userEvent.setup();
    renderWithRouter(<HomePage />);
    await user.click(screen.getByRole('button', { name: /看看过去的我/ }));
    expect(navigateMock).toHaveBeenCalledWith('/timeline');
  });

  it('renders the today card when there is a daily record today', () => {
    storeState.emotionHistory = [
      makeRecord({
        id: 'today',
        emotion: 'anxiety',
        intensity: 7,
        aiReflection: '我感受到你今天的压力，这一刻被看见了。',
      }),
    ];
    renderWithRouter(<HomePage />);
    expect(screen.getByText('今日卡片')).toBeInTheDocument();
    // emotion label + aiReflection summary
    expect(screen.getByText('焦虑')).toBeInTheDocument();
    expect(screen.getByText(/我感受到你今天的压力/)).toBeInTheDocument();
  });

  it('does NOT render the today card when emotionHistory is empty', () => {
    renderWithRouter(<HomePage />);
    expect(screen.queryByText('今日卡片')).not.toBeInTheDocument();
  });

  it('does not show a today card for yesterday’s daily records', () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    storeState.emotionHistory = [
      makeRecord({ id: 'y', timestamp: yesterday, aiReflection: '昨天的回应' }),
    ];
    renderWithRouter(<HomePage />);
    expect(screen.queryByText('今日卡片')).not.toBeInTheDocument();
  });

  it('keeps the theme toggle rendered', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByRole('button', { name: '切换主题' })).toBeInTheDocument();
  });
});
