/**
 * Basic adapter architecture tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAICompatibleAdapter } from '../OpenAICompatibleAdapter';
import { AdapterFactory, UnsupportedProviderError } from '../AdapterFactory';
import { AIProviderAdapter, ChatRequest, ChatResponse, APIError, ConfigError } from '../../types/adapter';
import type { AIProviderId } from '../../types/aiProvider';

// Mock the AI key manager
vi.mock('../../lib/aiKeyManager', () => ({
  getApiKey: vi.fn(),
}));

describe('Adapter Architecture', () => {
  describe('AIProviderAdapter Interface', () => {
    it('should define required properties and methods', () => {
      const mockAdapter: AIProviderAdapter = {
        providerId: 'openai' as AIProviderId,
        chat: async () => ({
          content: 'test',
          finishReason: 'stop',
          provider: 'openai',
          model: 'gpt-4o-mini'
        }),
        chatStream: async () => {
          // Streaming stub
        },
        isConfigured: () => true,
        validateApiKey: async () => true
      };

      expect(mockAdapter.providerId).toBe('openai');
      expect(typeof mockAdapter.chat).toBe('function');
      expect(typeof mockAdapter.chatStream).toBe('function');
      expect(typeof mockAdapter.isConfigured).toBe('function');
      expect(typeof mockAdapter.validateApiKey).toBe('function');
    });
  });

  describe('ChatRequest Type', () => {
    it('should accept valid chat request structure', () => {
      const request: ChatRequest = {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' }
        ],
        model: 'gpt-4o-mini',
        provider: 'openai',
        temperature: 0.7,
        maxTokens: 100
      };

      expect(request.messages).toHaveLength(2);
      expect(request.model).toBe('gpt-4o-mini');
      expect(request.temperature).toBe(0.7);
    });
  });

  describe('ChatResponse Type', () => {
    it('should accept valid chat response structure', () => {
      const response: ChatResponse = {
        content: 'Hello! How can I help?',
        finishReason: 'stop',
        provider: 'openai',
        model: 'gpt-4o-mini',
        usage: {
          promptTokens: 10,
          completionTokens: 8,
          totalTokens: 18
        }
      };

      expect(response.content).toBe('Hello! How can I help?');
      expect(response.finishReason).toBe('stop');
      expect(response.usage?.totalTokens).toBe(18);
    });
  });

  describe('Error Types', () => {
    it('should create APIError with correct properties', () => {
      const error = new APIError('Test error', 500, 'openai', true);
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.provider).toBe('openai');
      expect(error.isRetryable).toBe(true);
      expect(error.name).toBe('APIError');
    });

    it('should create ConfigError with correct properties', () => {
      const error = new ConfigError('Missing API key', 'VITE_OPENAI_API_KEY', 'openai');
      
      expect(error.message).toBe('Missing API key');
      expect(error.configKey).toBe('VITE_OPENAI_API_KEY');
      expect(error.provider).toBe('openai');
      expect(error.name).toBe('ConfigError');
    });

    it('should create UnsupportedProviderError with correct message', () => {
      const error = new UnsupportedProviderError('unknown');
      
      expect(error.message).toBe('Unsupported provider: unknown');
      expect(error.name).toBe('UnsupportedProviderError');
    });
  });

  describe('OpenAICompatibleAdapter', () => {
    it('should create adapter instance with provider ID', () => {
      const adapter = new OpenAICompatibleAdapter({
        provider: 'openai'
      });

      expect(adapter.providerId).toBe('openai');
    });

    it('should indicate not configured when no API key', () => {
      const { getApiKey } = require('../../lib/aiKeyManager');
      getApiKey.mockReturnValue({ source: 'none', key: undefined });

      const adapter = new OpenAICompatibleAdapter({
        provider: 'openai'
      });

      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe('AdapterFactory', () => {
    beforeEach(() => {
      // Clear factory cache before each test
      AdapterFactory.getInstance().clearCache();
    });

    it('should return OpenAI-compatible adapter for supported providers', () => {
      const factory = AdapterFactory.getInstance();
      const adapter = factory.getAdapter('openai');

      expect(adapter.providerId).toBe('openai');
    });

    it('should return same adapter instance from cache', () => {
      const factory = AdapterFactory.getInstance();
      const adapter1 = factory.getAdapter('deepseek');
      const adapter2 = factory.getAdapter('deepseek');

      expect(adapter1).toBe(adapter2);
    });

    it('should throw error for unsupported provider', () => {
      const factory = AdapterFactory.getInstance();
      
      expect(() => factory.getAdapter('unknown' as AIProviderId)).toThrow(UnsupportedProviderError);
    });

    it('should report hunyuan as unsupported provider', () => {
      const factory = AdapterFactory.getInstance();
      
      expect(factory.isSupported('hunyuan' as AIProviderId)).toBe(false);
    });

    it('should report unknown provider as unsupported', () => {
      const factory = AdapterFactory.getInstance();
      
      expect(factory.isSupported('unknown' as AIProviderId)).toBe(false);
    });

    it('should return list of supported providers', () => {
      const factory = AdapterFactory.getInstance();
      const providers = factory.getSupportedProviders();

      expect(providers).toContain('openai');
      expect(providers).toContain('deepseek');
      expect(providers).toHaveLength(6);
    });
  });
});
