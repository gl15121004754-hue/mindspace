/**
 * Zhipu Adapter Tests
 */

import { describe, it, expect } from 'vitest';
import { ZhipuAdapter } from '../ZhipuAdapter';
import { PROVIDER_CATALOG } from '../../config/aiCatalog';

describe('ZhipuAdapter', () => {
  describe('Instantiation', () => {
    it('should create adapter instance', () => {
      const adapter = new ZhipuAdapter();

      expect(adapter).toBeInstanceOf(ZhipuAdapter);
      expect(adapter.providerId).toBe('zhipu');
    });

    it('should have correct providerId', () => {
      const adapter = new ZhipuAdapter();

      expect(adapter.providerId).toBe('zhipu');
    });
  });

  describe('Required Methods', () => {
    it('should have chat method', () => {
      const adapter = new ZhipuAdapter();

      expect(typeof adapter.chat).toBe('function');
    });

    it('should have chatStream method', () => {
      const adapter = new ZhipuAdapter();

      expect(typeof adapter.chatStream).toBe('function');
    });

    it('should have isConfigured method', () => {
      const adapter = new ZhipuAdapter();

      expect(typeof adapter.isConfigured).toBe('function');
    });

    it('should have validateApiKey method', () => {
      const adapter = new ZhipuAdapter();

      expect(typeof adapter.validateApiKey).toBe('function');
    });
  });

  describe('Configuration', () => {
    it('should indicate not configured when no API key', () => {
      const adapter = new ZhipuAdapter();

      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe('API Key Validation', () => {
    it('should reject empty API key', async () => {
      const adapter = new ZhipuAdapter();

      const isValid = await adapter.validateApiKey('');

      expect(isValid).toBe(false);
    });

    it('should reject whitespace-only API key', async () => {
      const adapter = new ZhipuAdapter();

      const isValid = await adapter.validateApiKey('   ');

      expect(isValid).toBe(false);
    });
  });

  describe('Provider Configuration', () => {
    it('should use correct apiBase from PROVIDER_CATALOG', () => {
      const adapter = new ZhipuAdapter();

      expect(adapter.providerId).toBe('zhipu');
      expect(PROVIDER_CATALOG.zhipu.apiBase).toBe('https://open.bigmodel.cn/api/paas/v4');
    });

    it('should use correct envVarName', () => {
      expect(PROVIDER_CATALOG.zhipu.envVarName).toBe('VITE_ZHIPU_API_KEY');
    });

    it('should have defaultModel configured', () => {
      expect(PROVIDER_CATALOG.zhipu.defaultModel).toBe('glm-4.7');
    });
  });
});
