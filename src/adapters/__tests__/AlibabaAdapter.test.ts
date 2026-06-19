/**
 * Alibaba Adapter Tests
 */

import { describe, it, expect } from 'vitest';
import { AlibabaAdapter } from '../AlibabaAdapter';
import { PROVIDER_CATALOG } from '../../config/aiCatalog';

describe('AlibabaAdapter', () => {
  describe('Instantiation', () => {
    it('should create adapter instance', () => {
      const adapter = new AlibabaAdapter();

      expect(adapter).toBeInstanceOf(AlibabaAdapter);
      expect(adapter.providerId).toBe('alibaba');
    });

    it('should have correct providerId', () => {
      const adapter = new AlibabaAdapter();

      expect(adapter.providerId).toBe('alibaba');
    });
  });

  describe('Required Methods', () => {
    it('should have chat method', () => {
      const adapter = new AlibabaAdapter();

      expect(typeof adapter.chat).toBe('function');
    });

    it('should have chatStream method', () => {
      const adapter = new AlibabaAdapter();

      expect(typeof adapter.chatStream).toBe('function');
    });

    it('should have isConfigured method', () => {
      const adapter = new AlibabaAdapter();

      expect(typeof adapter.isConfigured).toBe('function');
    });

    it('should have validateApiKey method', () => {
      const adapter = new AlibabaAdapter();

      expect(typeof adapter.validateApiKey).toBe('function');
    });
  });

  describe('Configuration', () => {
    it('should indicate not configured when no API key', () => {
      const adapter = new AlibabaAdapter();

      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe('API Key Validation', () => {
    it('should reject empty API key', async () => {
      const adapter = new AlibabaAdapter();

      const isValid = await adapter.validateApiKey('');

      expect(isValid).toBe(false);
    });

    it('should reject whitespace-only API key', async () => {
      const adapter = new AlibabaAdapter();

      const isValid = await adapter.validateApiKey('   ');

      expect(isValid).toBe(false);
    });
  });

  describe('Provider Configuration', () => {
    it('should use correct apiBase from PROVIDER_CATALOG', () => {
      const adapter = new AlibabaAdapter();

      expect(adapter.providerId).toBe('alibaba');
      expect(PROVIDER_CATALOG.alibaba.apiBase).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
    });

    it('should use correct envVarName', () => {
      expect(PROVIDER_CATALOG.alibaba.envVarName).toBe('VITE_DASHSCOPE_API_KEY');
    });

    it('should have defaultModel configured', () => {
      expect(PROVIDER_CATALOG.alibaba.defaultModel).toBe('qwen-plus');
    });
  });
});
