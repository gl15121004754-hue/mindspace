/**
 * Unit tests for generateReflection — the AI call + graceful fallback.
 * Mirrors aiService.ts conventions: never throws; failures → local placeholder.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateReflection, FALLBACK_REFLECTION } from '../dailyReflection';
import {
  buildReflectionContext,
  type ResolvedReflectionConfig,
} from '../dailyReflection';
import type { EmotionRecord } from '../../types/storage';

// --- Mock dailyQuota (Issue #9) --------------------------------------------
// Platform-key quota check happens inside generateReflection; we stub it so the
// quota state is controllable and isolated from real localStorage.

const { quotaMock } = vi.hoisted(() => ({
  quotaMock: {
    canUse: true,
    consumed: 0,
  },
}));

vi.mock('../dailyQuota', () => ({
  DAILY_QUOTA_LIMIT: 3,
  canUsePlatformQuota: vi.fn(() => quotaMock.canUse),
  consumePlatformQuota: vi.fn(() => {
    quotaMock.consumed += 1;
  }),
}));

const mkRecord = (over: Partial<EmotionRecord>): EmotionRecord => ({
  id: 'today',
  emotion: 'anxiety',
  intensity: 6,
  timestamp: Date.now(),
  source: 'daily',
  ...over,
});

const config: ResolvedReflectionConfig = {
  source: 'user',
  config: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    apiKey: 'sk-test',
    provider: 'openai',
  },
  quotaExempt: true,
};

const ctx = () =>
  buildReflectionContext(mkRecord({}), [], null, []);

describe('generateReflection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the AI text on a successful call', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '我感受到你今天的压力，辛苦了。' } }],
      }),
    });

    const result = await generateReflection(ctx(), config);
    expect(result.reflection).toBe('我感受到你今天的压力，辛苦了。');
    expect(result.crisis).toBe(false);
    expect(result.fallback).toBe(false);
  });

  it('falls back to a placeholder on HTTP 401 (never throws)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'unauthorized',
    });

    const result = await generateReflection(ctx(), config);
    expect(result.fallback).toBe(true);
    expect(result.reflection).toBe(FALLBACK_REFLECTION);
    expect(result.crisis).toBe(false);
  });

  it('falls back on a network error (never throws)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));

    const result = await generateReflection(ctx(), config);
    expect(result.fallback).toBe(true);
    expect(result.reflection).toBe(FALLBACK_REFLECTION);
  });

  it('returns the placeholder immediately when config is null (no network call)', async () => {
    const noneConfig: ResolvedReflectionConfig = {
      source: 'none',
      config: null,
      quotaExempt: false,
    };

    const result = await generateReflection(ctx(), noneConfig);
    expect(result.fallback).toBe(true);
    expect(result.reflection).toBe(FALLBACK_REFLECTION);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('sends an OpenAI-compatible POST with system + user messages', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    });

    await generateReflection(ctx(), config);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(config.config!.apiUrl);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
  });
});

describe('generateReflection — crisis detection (Issue #8)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('short-circuits to intervention (no AI call) on self_harm text', async () => {
    const crisisCtx = buildReflectionContext(
      mkRecord({ context: '我真的不想活了' }),
      [],
      null,
      []
    );

    const result = await generateReflection(crisisCtx, config);

    expect(result.crisis).toBe(true);
    expect(result.reflection).toContain('400-161-9995'); // hotline surfaced
    // the AI must NOT have been called for a crisis
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns crisis=true pointing to SOS on panic text', async () => {
    const crisisCtx = buildReflectionContext(
      mkRecord({ context: '我喘不上气，要疯了' }),
      [],
      null,
      []
    );

    const result = await generateReflection(crisisCtx, config);

    expect(result.crisis).toBe(true);
    expect(result.reflection).toContain('SOS');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('still calls the AI when text has no crisis signal', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '正常的回应' } }],
      }),
    });

    const result = await generateReflection(
      buildReflectionContext(mkRecord({ context: '今天开会压力很大' }), [], null, []),
      config
    );

    expect(result.crisis).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('detects crisis even when no AI key is configured (crisis > no-config)', async () => {
    const noneConfig: ResolvedReflectionConfig = {
      source: 'none',
      config: null,
      quotaExempt: false,
    };
    const crisisCtx = buildReflectionContext(
      mkRecord({ context: '想结束这一切' }),
      [],
      null,
      []
    );

    const result = await generateReflection(crisisCtx, noneConfig);

    expect(result.crisis).toBe(true);
    expect(result.reflection).toContain('400-161-9995');
  });
});

describe('generateReflection — platform quota (Issue #9)', () => {
  // Platform-key config: quotaExempt false → quota applies.
  const platformConfig: ResolvedReflectionConfig = {
    source: 'platform',
    config: {
      apiUrl: 'https://dashscope.example/v1/chat/completions',
      model: 'qwen-plus',
      apiKey: 'sk-platform',
      provider: 'alibaba',
    },
    quotaExempt: false,
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    quotaMock.canUse = true;
    quotaMock.consumed = 0;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('calls the AI and consumes quota when platform key has remaining allowance', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '平台 Key 的回应' } }],
      }),
    });

    const result = await generateReflection(ctx(), platformConfig);

    expect(result.reflection).toBe('平台 Key 的回应');
    expect(result.fallback).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(quotaMock.consumed).toBe(1);
  });

  it('returns the quota-exhausted placeholder (no AI call) when allowance is used up', async () => {
    quotaMock.canUse = false;

    const result = await generateReflection(ctx(), platformConfig);

    expect(result.fallback).toBe(true);
    // placeholder must NOT pretend to be AI, and should point to chat
    expect(result.reflection).not.toBe('平台 Key 的回应');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    // quota is NOT consumed when blocked (it was already at the limit)
    expect(quotaMock.consumed).toBe(0);
  });

  it('user key (quotaExempt) skips quota entirely — no check, no consume', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '用户 Key 回应' } }],
      }),
    });

    const result = await generateReflection(ctx(), config); // config has quotaExempt: true

    expect(result.reflection).toBe('用户 Key 回应');
    expect(quotaMock.consumed).toBe(0);
  });

  it('crisis bypasses quota even on the platform key path', async () => {
    quotaMock.canUse = false; // quota exhausted
    const crisisCtx = buildReflectionContext(
      mkRecord({ context: '不想活了' }),
      [],
      null,
      []
    );

    const result = await generateReflection(crisisCtx, platformConfig);

    expect(result.crisis).toBe(true);
    expect(result.reflection).toContain('400-161-9995');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(quotaMock.consumed).toBe(0);
  });
});


