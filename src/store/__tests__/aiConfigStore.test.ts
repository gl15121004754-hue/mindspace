/**
 * aiConfigStore — resolveChatConfig() regression test.
 *
 * Guards the core defect fix from the catalog unification: the chat path must
 * resolve the user's *selected* model (from defaultModels), not a hardcoded
 * provider default. Before this refactor, enhancedChatService read its own
 * private PROVIDER_CONFIG and ignored the store entirely.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAIConfigStore } from '../aiConfigStore';

describe('aiConfigStore.resolveChatConfig', () => {
  const ORIGINAL = localStorage.getItem('mindspace-ai-config');

  beforeEach(() => {
    localStorage.clear();
    // Reset the zustand store to a clean initial state before each test.
    useAIConfigStore.setState({
      selectedProvider: 'openai',
      customApiKeys: {},
      defaultModels: {},
    });
  });

  afterEach(() => {
    if (ORIGINAL !== null) {
      localStorage.setItem('mindspace-ai-config', ORIGINAL);
    } else {
      localStorage.removeItem('mindspace-ai-config');
    }
  });

  it('uses the catalog default model when the user has not chosen one', () => {
    useAIConfigStore.setState({
      selectedProvider: 'grok',
      customApiKeys: { grok: 'sk-test' },
      defaultModels: {},
    });

    const cfg = useAIConfigStore.getState().resolveChatConfig();

    // Catalog default for grok is grok-4 (NOT the deprecated grok-beta).
    expect(cfg.provider).toBe('grok');
    expect(cfg.model).toBe('grok-4');
    expect(cfg.apiUrl).toBe('https://api.x.ai/v1/chat/completions');
    expect(cfg.apiKey).toBe('sk-test');
  });

  it('uses the user-selected model, not the catalog default (defect-fix guard)', () => {
    useAIConfigStore.setState({
      selectedProvider: 'grok',
      customApiKeys: { grok: 'sk-test' },
      defaultModels: { grok: 'grok-4-fast' }, // user picked the fast variant
    });

    const cfg = useAIConfigStore.getState().resolveChatConfig();

    // This is the regression that was silently broken before: chat ignored the
    // selection and always used PROVIDER_CONFIG.grok.model ('grok-4').
    expect(cfg.model).toBe('grok-4-fast');
  });

  it('derives the endpoint from the catalog apiBase + /chat/completions', () => {
    useAIConfigStore.setState({
      selectedProvider: 'deepseek',
      customApiKeys: { deepseek: 'sk-test' },
      defaultModels: {},
    });

    const cfg = useAIConfigStore.getState().resolveChatConfig();

    // deepseek apiBase is normalized to .../v1 in the catalog.
    expect(cfg.apiUrl).toBe('https://api.deepseek.com/v1/chat/completions');
  });

  it('returns an empty apiKey when none is stored (chat falls back to local response)', () => {
    useAIConfigStore.setState({
      selectedProvider: 'openai',
      customApiKeys: {},
      defaultModels: {},
    });

    const cfg = useAIConfigStore.getState().resolveChatConfig();

    expect(cfg.apiKey).toBe('');
  });
});

describe('aiConfigStore.getCurrentModel', () => {
  beforeEach(() => {
    localStorage.clear();
    useAIConfigStore.setState({
      selectedProvider: 'openai',
      customApiKeys: {},
      defaultModels: {},
    });
  });

  it('falls back to the catalog default when no model chosen', () => {
    useAIConfigStore.setState({ selectedProvider: 'zhipu' });

    // Catalog default for zhipu is glm-4.7 (NOT the deprecated glm-4-flash).
    expect(useAIConfigStore.getState().getCurrentModel()).toBe('glm-4.7');
  });

  it('returns the user-chosen model when set', () => {
    useAIConfigStore.setState({
      selectedProvider: 'zhipu',
      defaultModels: { zhipu: 'glm-4.6' },
    });

    expect(useAIConfigStore.getState().getCurrentModel()).toBe('glm-4.6');
  });
});
