/**
 * Unit tests for resolveReflectionConfig — the unified AI key resolution that
 * collapses the two previously-disjoint paths (SOS platform key vs chat user
 * key) into one decision. See ADR-0004.
 *
 * User key wins over platform key; platform key is quota-bound; none → no config.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveReflectionConfig } from '../dailyReflection';

// --- Mocks --------------------------------------------------------------

const { configState, keyState } = vi.hoisted(() => ({
  configState: {
    resolveChatConfig: vi.fn(),
  },
  keyState: {
    getApiKey: vi.fn(),
  },
}));

vi.mock('../../store/aiConfigStore', () => ({
  useAIConfigStore: {
    getState: () => configState,
  },
}));

vi.mock('../aiKeyManager', () => ({
  getApiKey: (provider: string) => keyState.getApiKey(provider),
}));

const USER_CONFIG = {
  provider: 'openai',
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  apiKey: 'sk-user-key',
};

const PLATFORM_CONFIG = {
  provider: 'alibaba',
  apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  model: 'qwen-plus',
  apiKey: 'sk-platform-key',
};

describe('resolveReflectionConfig', () => {
  beforeEach(() => {
    configState.resolveChatConfig.mockReset();
    keyState.getApiKey.mockReset();
  });

  it('uses the user key when configured, marking quotaExempt=true', () => {
    configState.resolveChatConfig.mockReturnValue(USER_CONFIG);

    const result = resolveReflectionConfig();

    expect(result.source).toBe('user');
    expect(result.config?.apiKey).toBe('sk-user-key');
    expect(result.config?.apiUrl).toBe(USER_CONFIG.apiUrl);
    expect(result.quotaExempt).toBe(true);
  });

  it('falls back to platform key when user has no key, marking quotaExempt=false', () => {
    configState.resolveChatConfig.mockReturnValue({
      ...USER_CONFIG,
      apiKey: '', // user not configured
    });
    keyState.getApiKey.mockReturnValue({ key: 'sk-platform-key', source: 'env' });

    const result = resolveReflectionConfig();

    expect(result.source).toBe('platform');
    expect(result.config?.apiKey).toBe('sk-platform-key');
    expect(result.quotaExempt).toBe(false);
  });

  it('returns source=none when neither user nor platform key is available', () => {
    configState.resolveChatConfig.mockReturnValue({ ...USER_CONFIG, apiKey: '' });
    keyState.getApiKey.mockReturnValue({ key: '', source: 'none' });

    const result = resolveReflectionConfig();

    expect(result.source).toBe('none');
    expect(result.config).toBeNull();
  });

  it('prefers user key over platform key when both exist', () => {
    configState.resolveChatConfig.mockReturnValue(USER_CONFIG);
    keyState.getApiKey.mockReturnValue({ key: 'sk-platform-key', source: 'env' });

    const result = resolveReflectionConfig();

    expect(result.source).toBe('user');
    expect(result.config?.apiKey).toBe('sk-user-key');
    // platform key should NOT have been consulted
    expect(keyState.getApiKey).not.toHaveBeenCalled();
  });

  it('falls back to platform key provider config (not the user-selected provider)', () => {
    // user selected 'openai' but has no key; platform fallback uses alibaba/qwen
    configState.resolveChatConfig.mockReturnValue({
      ...USER_CONFIG,
      apiKey: '',
    });
    keyState.getApiKey.mockReturnValue({ key: 'sk-platform-key', source: 'env' });

    const result = resolveReflectionConfig();

    expect(result.source).toBe('platform');
    // platform config is the alibaba/qwen endpoint, not the user's openai selection
    expect(result.config?.apiUrl).toBe(PLATFORM_CONFIG.apiUrl);
    expect(result.config?.model).toBe(PLATFORM_CONFIG.model);
  });
});
