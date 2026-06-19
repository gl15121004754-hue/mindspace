/**
 * Component tests for DailyRecordPage — the "log a mood" surface for the daily
 * record loop (Issue #6, no AI reflection yet). We assert external behavior:
 * what gets submitted to the store and what renders, never internal state.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import DailyRecordPage from '../DailyRecordPage';
import type { EmotionRecord } from '../../types/storage';

// --- Mock useAppStore ------------------------------------------------------
// DailyRecordPage reads emotionHistory and calls addEmotionRecord. The existing
// components.test.tsx mock omits addEmotionRecord, so we build a focused mock
// here with a stub that records what was submitted.

type StoreLike = {
  emotionHistory: EmotionRecord[];
  addEmotionRecord: ReturnType<typeof vi.fn>;
  updateEmotionRecord: ReturnType<typeof vi.fn>;
};

const { storeState, submitted, updated } = vi.hoisted(() => ({
  storeState: {
    emotionHistory: [] as EmotionRecord[],
  } as StoreLike,
  submitted: { value: null as unknown },
  updated: { calls: [] as Array<{ id: string; updates: unknown }> },
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

let idCounter = 0;
const addEmotionRecordStub = vi.fn(async (record: Omit<EmotionRecord, 'id' | 'timestamp'>) => {
  submitted.value = record;
  idCounter += 1;
  const created: EmotionRecord = {
    ...record,
    id: `new-id-${idCounter}`,
    timestamp: Date.now(),
  };
  storeState.emotionHistory = [created, ...storeState.emotionHistory];
  return created;
});

const updateEmotionRecordStub = vi.fn(
  async (id: string, updates: Record<string, unknown>) => {
    updated.calls.push({ id, updates });
    // apply the update to the in-memory history so the UI reflects it
    storeState.emotionHistory = storeState.emotionHistory.map((r) =>
      r.id === id ? ({ ...r, ...updates } as EmotionRecord) : r
    );
    return storeState.emotionHistory.find((r) => r.id === id) ?? null;
  }
);

// --- Mock dailyReflection (AI layer) ---------------------------------------
// The page calls generateReflection after submit; we stub it to a deterministic
// reply so component tests don't touch the network.

const { reflectionReturn } = vi.hoisted(() => ({
  reflectionReturn: {
    reflection: '我感受到你今天的压力，这一刻被看见了。',
    fallback: false,
    crisis: false,
  } as { reflection: string; fallback: boolean; crisis: boolean },
}));

vi.mock('../../lib/dailyReflection', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dailyReflection')>(
    '../../lib/dailyReflection'
  );
  return {
    ...actual,
    generateReflection: vi.fn(async () => reflectionReturn),
    resolveReflectionConfig: vi.fn(() => ({
      source: 'user',
      config: {
        apiUrl: 'https://example/api',
        model: 'm',
        apiKey: 'k',
        provider: 'openai',
      },
      quotaExempt: true,
    })),
  };
});

const renderWithRouter = (component: React.ReactNode) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

describe('DailyRecordPage', () => {
  beforeEach(() => {
    storeState.emotionHistory = [];
    storeState.addEmotionRecord = addEmotionRecordStub;
    storeState.updateEmotionRecord = updateEmotionRecordStub;
    addEmotionRecordStub.mockClear();
    updateEmotionRecordStub.mockClear();
    submitted.value = null;
    updated.calls = [];
    idCounter = 0;
  });

  it('renders all 10 emotions including the 4 positive ones', () => {
    renderWithRouter(<DailyRecordPage />);
    ['焦虑', '愤怒', '悲伤', '惊恐', '过载', '疲惫', '平静', '开心', '感激', '放松'].forEach(
      (label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    );
  });

  it('submits a daily record with emotion, intensity and text, tagged source=daily', async () => {
    const user = userEvent.setup();
    renderWithRouter(<DailyRecordPage />);

    await user.click(screen.getByText('焦虑'));
    // intensity 1-10: pick "6"
    await user.click(screen.getByRole('button', { name: /6/ }));
    await user.type(screen.getByPlaceholderText(/想说点什么|不写/), '今天开会压力很大');
    await user.click(screen.getByRole('button', { name: /记下这一刻|正在回应/ }));

    await waitFor(() => {
      expect(addEmotionRecordStub).toHaveBeenCalledTimes(1);
    });
    expect(submitted.value).toMatchObject({
      emotion: 'anxiety',
      intensity: 6,
      source: 'daily',
      context: '今天开会压力很大',
    });
  });

  it('allows submitting without text (text is optional)', async () => {
    const user = userEvent.setup();
    renderWithRouter(<DailyRecordPage />);

    await user.click(screen.getByText('开心'));
    await user.click(screen.getByRole('button', { name: /8/ }));
    await user.click(screen.getByRole('button', { name: /记下这一刻|正在回应/ }));

    await waitFor(() => {
      expect(addEmotionRecordStub).toHaveBeenCalledTimes(1);
    });
    expect(submitted.value).toMatchObject({ emotion: 'happy', intensity: 8, source: 'daily' });
    expect((submitted.value as { context?: string }).context).toBeFalsy();
  });

  it('shows today’s records after submit, without blocking a second submit', async () => {
    const user = userEvent.setup();
    renderWithRouter(<DailyRecordPage />);

    await user.click(screen.getByText('疲惫'));
    await user.click(screen.getByRole('button', { name: /^7$/ }));
    await user.click(screen.getByRole('button', { name: /记下这一刻|正在回应/ }));

    await waitFor(() => {
      expect(screen.getAllByText('疲惫').length).toBeGreaterThan(0);
    });

    // dismiss the reflection so it doesn't shadow the next submit
    await user.click(screen.getByRole('button', { name: /记下了，谢谢|谢谢/ }));

    // a second submission the same day must not be blocked
    await user.click(screen.getByText('平静'));
    await user.click(screen.getByRole('button', { name: /^5$/ }));
    await user.click(screen.getByRole('button', { name: /记下这一刻|正在回应/ }));

    await waitFor(() => {
      expect(addEmotionRecordStub).toHaveBeenCalledTimes(2);
    });
  });

  it('does not submit when emotion or intensity is missing', async () => {
    const user = userEvent.setup();
    renderWithRouter(<DailyRecordPage />);

    // pick emotion only, no intensity -> submit should be disabled or a no-op
    await user.click(screen.getByText('悲伤'));
    const submit = screen.getByRole('button', { name: /记下这一刻|正在回应/ });
    if (!submit.hasAttribute('disabled')) {
      await user.click(submit);
    }
    expect(addEmotionRecordStub).not.toHaveBeenCalled();
  });

  it('renders the intensity scale as 1-10', () => {
    renderWithRouter(<DailyRecordPage />);
    // every intensity 1..10 should be present as a button
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((n) => {
      expect(screen.getByRole('button', { name: String(n) })).toBeInTheDocument();
    });
  });
});

describe('DailyRecordPage — AI reflection (Issue #7)', () => {
  beforeEach(() => {
    storeState.emotionHistory = [];
    storeState.addEmotionRecord = addEmotionRecordStub;
    storeState.updateEmotionRecord = updateEmotionRecordStub;
    addEmotionRecordStub.mockClear();
    updateEmotionRecordStub.mockClear();
    submitted.value = null;
    updated.calls = [];
    idCounter = 0;
    reflectionReturn.reflection = '我感受到你今天的压力，这一刻被看见了。';
    reflectionReturn.fallback = false;
    reflectionReturn.crisis = false;
  });

  it('generates a reflection after submit and persists it to aiReflection', async () => {
    const user = userEvent.setup();
    renderWithRouter(<DailyRecordPage />);

    await user.click(screen.getByText('焦虑'));
    await user.click(screen.getByRole('button', { name: /^6$/ }));
    await user.type(screen.getByPlaceholderText(/想说点什么|不写/), '今天开会压力很大');
    await user.click(screen.getByRole('button', { name: /记下这一刻|正在回应/ }));

    // reflection shows up
    await waitFor(() => {
      expect(screen.getByText('我感受到你今天的压力，这一刻被看见了。')).toBeInTheDocument();
    });

    // aiReflection was persisted via updateEmotionRecord
    expect(updateEmotionRecordStub).toHaveBeenCalledTimes(1);
    expect(updated.calls[0].updates).toMatchObject({
      aiReflection: '我感受到你今天的压力，这一刻被看见了。',
    });
  });

  it('shows the three structured routing options after a reflection', async () => {
    const user = userEvent.setup();
    renderWithRouter(<DailyRecordPage />);

    await user.click(screen.getByText('疲惫'));
    await user.click(screen.getByRole('button', { name: /^7$/ }));
    await user.click(screen.getByRole('button', { name: /记下这一刻|正在回应/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /想再聊聊|聊聊/ })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /很难受|急救|SOS/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /记下了|谢谢/ })).toBeInTheDocument();
  });

  it('does not render a multi-turn reply input in the reflection area', async () => {
    const user = userEvent.setup();
    renderWithRouter(<DailyRecordPage />);

    await user.click(screen.getByText('平静'));
    await user.click(screen.getByRole('button', { name: /^5$/ }));
    await user.click(screen.getByRole('button', { name: /记下这一刻|正在回应/ }));

    await waitFor(() => {
      expect(screen.getByText('我感受到你今天的压力，这一刻被看见了。')).toBeInTheDocument();
    });

    // only the original note textarea should exist; no second reply box
    const textareas = screen.getAllByRole('textbox');
    expect(textareas.length).toBe(1);
  });

  it('still works when reflection is a fallback (no AI key / failure)', async () => {
    reflectionReturn.reflection = '（占位回应）';
    reflectionReturn.fallback = true;

    const user = userEvent.setup();
    renderWithRouter(<DailyRecordPage />);

    await user.click(screen.getByText('悲伤'));
    await user.click(screen.getByRole('button', { name: /^6$/ }));
    await user.click(screen.getByRole('button', { name: /记下这一刻|正在回应/ }));

    await waitFor(() => {
      expect(screen.getByText('（占位回应）')).toBeInTheDocument();
    });
    // fallback is still archived to aiReflection
    expect(updated.calls[0].updates).toMatchObject({ aiReflection: '（占位回应）' });
  });
});

describe('DailyRecordPage — crisis reflection (Issue #8)', () => {
  beforeEach(() => {
    storeState.emotionHistory = [];
    storeState.addEmotionRecord = addEmotionRecordStub;
    storeState.updateEmotionRecord = updateEmotionRecordStub;
    addEmotionRecordStub.mockClear();
    updateEmotionRecordStub.mockClear();
    submitted.value = null;
    updated.calls = [];
    idCounter = 0;
  });

  it('surfaces the crisis hotline when the reflection is a crisis response', async () => {
    // Simulate generateReflection returning a self_harm intervention containing the hotline.
    reflectionReturn.reflection =
      '我听到了你此刻的痛苦。\n如果需要专业支持，可以拨打心理援助热线：400-161-9995';
    reflectionReturn.crisis = true;
    reflectionReturn.fallback = false;

    const user = userEvent.setup();
    renderWithRouter(<DailyRecordPage />);

    await user.click(screen.getByText('悲伤'));
    await user.click(screen.getByRole('button', { name: /^9$/ }));
    await user.type(screen.getByPlaceholderText(/想说点什么|不写/), '不想活了');
    await user.click(screen.getByRole('button', { name: /记下这一刻|正在回应/ }));

    await waitFor(() => {
      // the hotline appears in the reflection area (and is also archived to the
      // today-records list, so it may appear more than once — that's correct).
      expect(screen.getAllByText(/400-161-9995/).length).toBeGreaterThan(0);
    });

    // the crisis intervention is archived to aiReflection (reviewable later)
    expect(updated.calls[0].updates).toMatchObject({
      aiReflection: expect.stringContaining('400-161-9995'),
    });
  });

  it('keeps the "想再聊聊" routing option available during a crisis', async () => {
    reflectionReturn.reflection = '感受到你的紧张，可以先做一次急救练习。下面有「现在很难受」入口，可以随时进入 SOS。';
    reflectionReturn.crisis = true;
    reflectionReturn.fallback = false;

    const user = userEvent.setup();
    renderWithRouter(<DailyRecordPage />);

    await user.click(screen.getByText('惊恐'));
    await user.click(screen.getByRole('button', { name: /^10$/ }));
    await user.click(screen.getByRole('button', { name: /记下这一刻|正在回应/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /想再聊聊|聊聊/ })).toBeInTheDocument();
    });
    // the SOS routing is also reachable
    expect(screen.getByRole('button', { name: /很难受|急救|SOS/i })).toBeInTheDocument();
  });
});

describe('DailyRecordPage — quota exhaustion (Issue #9)', () => {
  beforeEach(() => {
    storeState.emotionHistory = [];
    storeState.addEmotionRecord = addEmotionRecordStub;
    storeState.updateEmotionRecord = updateEmotionRecordStub;
    addEmotionRecordStub.mockClear();
    updateEmotionRecordStub.mockClear();
    submitted.value = null;
    updated.calls = [];
    idCounter = 0;
  });

  it('shows the quota-exhausted placeholder when the free allowance is used up', async () => {
    // Simulate generateReflection returning the quota-exhausted placeholder.
    reflectionReturn.reflection =
      '今天的免费 AI 回应额度用完啦。你的感受依然被认真对待——想继续倾诉的话，可以去对话里聊聊，或在设置里连接你自己的 AI。';
    reflectionReturn.fallback = true;
    reflectionReturn.crisis = false;

    const user = userEvent.setup();
    renderWithRouter(<DailyRecordPage />);

    await user.click(screen.getByText('焦虑'));
    await user.click(screen.getByRole('button', { name: /^6$/ }));
    await user.click(screen.getByRole('button', { name: /记下这一刻|正在回应/ }));

    await waitFor(() => {
      // appears in the reflection area and is also archived to the today list
      expect(screen.getAllByText(/额度用完/).length).toBeGreaterThan(0);
    });

    // the quota placeholder is still archived to aiReflection (reviewable)
    expect(updated.calls[0].updates).toMatchObject({
      aiReflection: expect.stringContaining('额度用完'),
    });
  });
});
