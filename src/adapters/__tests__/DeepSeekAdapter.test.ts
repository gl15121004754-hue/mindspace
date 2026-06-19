/**
 * DeepSeek Adapter Tests
 */

import { describe, it, expect } from 'vitest';
import { DeepSeekAdapter } from '../DeepSeekAdapter';
import { PROVIDER_CATALOG } from '../../config/aiCatalog';

describe('DeepSeekAdapter', () => {
  describe('Instantiation', () => {
    it('should create adapter instance', () => {
      const adapter = new DeepSeekAdapter();

      expect(adapter).toBeInstanceOf(DeepSeekAdapter);
      expect(adapter.providerId).toBe('deepseek');
    });

    it('should have correct providerId', () => {
      const adapter = new DeepSeekAdapter();

      expect(adapter.providerId).toBe('deepseek');
    });
  });

  describe('Required Methods', () => {
    it('should have chat method', () => {
      const adapter = new DeepSeekAdapter();

      expect(typeof adapter.chat).toBe('function');
    });

    it('should have chatStream method', () => {
      const adapter = new DeepSeekAdapter();

      expect(typeof adapter.chatStream).toBe('function');
    });

    it('should have isConfigured method', () => {
      const adapter = new DeepSeekAdapter();

      expect(typeof adapter.isConfigured).toBe('function');
    });

    it('should have validateApiKey method', () => {
      const adapter = new DeepSeekAdapter();

      expect(typeof adapter.validateApiKey).toBe('function');
    });
  });

  describe('Configuration', () => {
    it('should indicate not configured when no API key', () => {
      const adapter = new DeepSeekAdapter();

      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe('API Key Validation', () => {
    it('should reject empty API key', async () => {
      const adapter = new DeepSeekAdapter();

      const isValid = await adapter.validateApiKey('');

      expect(isValid).toBe(false);
    });

    it('should reject whitespace-only API key', async () => {
      const adapter = new DeepSeekAdapter();

      const isValid = await adapter.validateApiKey('   ');

      expect(isValid).toBe(false);
    });
  });

  describe('Provider Configuration', () => {
    it('should use correct apiBase from PROVIDER_CATALOG', () => {
      const adapter = new DeepSeekAdapter();

      expect(adapter.providerId).toBe('deepseek');
      expect(PROVIDER_CATALOG.deepseek.apiBase).toBe('https://api.deepseek.com/v1');
    });

    it('should use correct envVarName', () => {
      expect(PROVIDER_CATALOG.deepseek.envVarName).toBe('VITE_DEEPSEEK_API_KEY');
    });

    it('should have defaultModel configured', () => {
      expect(PROVIDER_CATALOG.deepseek.defaultModel).toBe('deepseek-chat');
    });
  });
});
