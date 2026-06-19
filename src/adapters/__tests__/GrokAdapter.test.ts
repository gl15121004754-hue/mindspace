/**
 * Grok Adapter Tests
 */

import { describe, it, expect } from 'vitest';
import { GrokAdapter } from '../GrokAdapter';
import { PROVIDER_CATALOG } from '../../config/aiCatalog';

describe('GrokAdapter', () => {
  describe('Instantiation', () => {
    it('should create adapter instance', () => {
      const adapter = new GrokAdapter();

      expect(adapter).toBeInstanceOf(GrokAdapter);
      expect(adapter.providerId).toBe('grok');
    });

    it('should have correct providerId', () => {
      const adapter = new GrokAdapter();

      expect(adapter.providerId).toBe('grok');
    });
  });

  describe('Required Methods', () => {
    it('should have chat method', () => {
      const adapter = new GrokAdapter();

      expect(typeof adapter.chat).toBe('function');
    });

    it('should have chatStream method', () => {
      const adapter = new GrokAdapter();

      expect(typeof adapter.chatStream).toBe('function');
    });

    it('should have isConfigured method', () => {
      const adapter = new GrokAdapter();

      expect(typeof adapter.isConfigured).toBe('function');
    });

    it('should have validateApiKey method', () => {
      const adapter = new GrokAdapter();

      expect(typeof adapter.validateApiKey).toBe('function');
    });
  });

  describe('Configuration', () => {
    it('should indicate not configured when no API key', () => {
      const adapter = new GrokAdapter();

      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe('API Key Validation', () => {
    it('should reject empty API key', async () => {
      const adapter = new GrokAdapter();

      const isValid = await adapter.validateApiKey('');

      expect(isValid).toBe(false);
    });

    it('should reject whitespace-only API key', async () => {
      const adapter = new GrokAdapter();

      const isValid = await adapter.validateApiKey('   ');

      expect(isValid).toBe(false);
    });
  });

  describe('Provider Configuration', () => {
    it('should use correct apiBase from PROVIDER_CATALOG', () => {
      const adapter = new GrokAdapter();

      expect(adapter.providerId).toBe('grok');
      expect(PROVIDER_CATALOG.grok.apiBase).toBe('https://api.x.ai/v1');
    });

    it('should use correct envVarName', () => {
      expect(PROVIDER_CATALOG.grok.envVarName).toBe('VITE_GROK_API_KEY');
    });

    it('should have defaultModel configured (curated, not the deprecated beta)', () => {
      expect(PROVIDER_CATALOG.grok.defaultModel).toBe('grok-4');
    });
  });
});
