/**
 * AI Catalog Tests
 *
 * Validates the curated provider/model catalog (config/aiCatalog.ts) — the
 * single static source of truth. Covers provider coverage, model fields,
 * uniqueness, per-provider model lists, deprecation exclusions, streaming
 * support, and the lookup helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  getModelsByProvider,
  getModelById,
  getAllModels,
  getAllModelIds,
  isValidModelForProvider,
  resolveChatEndpoint,
  MODEL_REGISTRY,
  PROVIDER_CATALOG,
  PROVIDER_ORDER,
  type AIModel,
} from '../aiCatalog';
import type { AIProviderId } from '../../types/aiProvider';

describe('AI Catalog', () => {
  describe('Provider Coverage', () => {
    it('should have entries for all 6 providers', () => {
      const providers: AIProviderId[] = ['openai', 'zhipu', 'grok', 'deepseek', 'minimax', 'alibaba'];

      providers.forEach((provider) => {
        expect(PROVIDER_CATALOG[provider]).toBeDefined();
      });
    });

    it('should have models for all providers in PROVIDER_ORDER', () => {
      PROVIDER_ORDER.forEach((provider) => {
        const models = getModelsByProvider(provider);
        expect(models.length).toBeGreaterThan(0);
      });
    });

    it('should have minimum 6 total models', () => {
      const allModels = getAllModels();
      expect(allModels.length).toBeGreaterThanOrEqual(7);
    });

    it('PROVIDER_ORDER should match catalog keys', () => {
      expect(PROVIDER_ORDER).toEqual(Object.keys(PROVIDER_CATALOG) as AIProviderId[]);
    });
  });

  describe('Model Fields', () => {
    it('should have required fields for all models', () => {
      const allModels = getAllModels();

      allModels.forEach((model) => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('contextLength');
        expect(model).toHaveProperty('supportsStreaming');
      });
    });

    it('should have valid field types', () => {
      const allModels = getAllModels();

      allModels.forEach((model: AIModel) => {
        expect(typeof model.id).toBe('string');
        expect(typeof model.name).toBe('string');
        expect(typeof model.provider).toBe('string');
        expect(typeof model.contextLength).toBe('number');
        expect(typeof model.supportsStreaming).toBe('boolean');
      });
    });

    it('should have positive context length for all models', () => {
      const allModels = getAllModels();

      allModels.forEach((model: AIModel) => {
        expect(model.contextLength).toBeGreaterThan(0);
      });
    });
  });

  describe('Model Uniqueness', () => {
    it('should have unique model IDs across all providers', () => {
      const allIds = getAllModels().map((m: AIModel) => m.id);
      const uniqueIds = new Set(allIds);

      expect(uniqueIds.size).toBe(allIds.length);
    });
  });

  describe('Per-Provider Models', () => {
    it('should have OpenAI models (default-first order)', () => {
      const openaiModels = getModelsByProvider('openai');

      expect(openaiModels.length).toBe(2);
      expect(openaiModels.map((m: AIModel) => m.id)).toEqual(['gpt-4o-mini', 'gpt-4o']);
    });

    it('should have Zhipu models', () => {
      const zhipuModels = getModelsByProvider('zhipu');

      expect(zhipuModels.length).toBe(3);
      expect(zhipuModels.map((m: AIModel) => m.id)).toEqual(['glm-4.7', 'glm-4.7-flash', 'glm-4.6']);
    });

    it('should have DeepSeek models', () => {
      const deepseekModels = getModelsByProvider('deepseek');

      expect(deepseekModels.length).toBe(2);
      expect(deepseekModels.map((m: AIModel) => m.id)).toEqual(['deepseek-chat', 'deepseek-reasoner']);
    });

    it('should have Alibaba models (default-first order)', () => {
      const alibabaModels = getModelsByProvider('alibaba');

      expect(alibabaModels.length).toBe(3);
      expect(alibabaModels.map((m: AIModel) => m.id)).toEqual(['qwen-plus', 'qwen3-max', 'qwen-flash']);
    });

    it('should have MiniMax models', () => {
      const minimaxModels = getModelsByProvider('minimax');

      expect(minimaxModels.length).toBe(2);
      expect(minimaxModels.map((m: AIModel) => m.id)).toEqual(['MiniMax-M2.1', 'MiniMax-M2.1-lightning']);
    });

    it('should have Grok models', () => {
      const grokModels = getModelsByProvider('grok');

      expect(grokModels.length).toBe(2);
      expect(grokModels.map((m: AIModel) => m.id)).toEqual(['grok-4', 'grok-4-fast']);
    });
  });

  describe('defaultModel invariant', () => {
    it('defaultModel should equal models[0].id for every provider', () => {
      PROVIDER_ORDER.forEach((provider) => {
        const entry = PROVIDER_CATALOG[provider];
        expect(entry.defaultModel).toBe(entry.models[0].id);
      });
    });
  });

  describe('Deprecated Models Excluded', () => {
    it('should not include gpt-3.5-turbo', () => {
      expect(getAllModelIds()).not.toContain('gpt-3.5-turbo');
    });

    it('should not include gemini-2.0-flash-exp', () => {
      expect(getAllModelIds()).not.toContain('gemini-2.0-flash-exp');
    });

    it('should not include abab6 models', () => {
      const allIds = getAllModelIds();

      expect(allIds).not.toContain('abab6.5s-chat');
      expect(allIds).not.toContain('abab6');
    });

    it('should not include grok-beta', () => {
      expect(getAllModelIds()).not.toContain('grok-beta');
    });
  });

  describe('Streaming Support', () => {
    it('should have streaming support enabled for all models', () => {
      getAllModels().forEach((model: AIModel) => {
        expect(model.supportsStreaming).toBe(true);
      });
    });
  });

  describe('Provider Assignment', () => {
    it('should correctly assign provider to each model', () => {
      PROVIDER_ORDER.forEach((provider) => {
        getModelsByProvider(provider).forEach((model: AIModel) => {
          expect(model.provider).toBe(provider);
        });
      });
    });
  });

  describe('Model Lookup Functions', () => {
    it('should find existing model by provider and id', () => {
      const model = getModelById('openai', 'gpt-4o');

      expect(model).toBeDefined();
      expect(model?.id).toBe('gpt-4o');
      expect(model?.name).toBe('GPT-4o');
    });

    it('should return undefined for non-existing model', () => {
      expect(getModelById('openai', 'non-existing-model')).toBeUndefined();
    });

    it('should validate existing model correctly', () => {
      expect(isValidModelForProvider('openai', 'gpt-4o')).toBe(true);
    });

    it('should invalidate non-existing model correctly', () => {
      expect(isValidModelForProvider('openai', 'non-existing-model')).toBe(false);
    });
  });

  describe('MODEL_REGISTRY', () => {
    it('getCount should match getAllModels length', () => {
      expect(MODEL_REGISTRY.getCount()).toBe(getAllModels().length);
    });

    it('getProviders should return all 6 provider ids', () => {
      expect(MODEL_REGISTRY.getProviders()).toHaveLength(6);
      expect(MODEL_REGISTRY.getProviders()).toEqual(PROVIDER_ORDER);
    });

    it('has should reflect membership', () => {
      expect(MODEL_REGISTRY.has('openai', 'gpt-4o')).toBe(true);
      expect(MODEL_REGISTRY.has('openai', 'nope')).toBe(false);
    });
  });

  describe('Endpoint derivation', () => {
    it('should append /chat/completions to apiBase', () => {
      expect(resolveChatEndpoint('openai')).toBe('https://api.openai.com/v1/chat/completions');
      expect(resolveChatEndpoint('deepseek')).toBe('https://api.deepseek.com/v1/chat/completions');
    });

    it('should return empty string for an unknown provider', () => {
      expect(resolveChatEndpoint('hunyuan' as AIProviderId)).toBe('');
    });
  });
});
