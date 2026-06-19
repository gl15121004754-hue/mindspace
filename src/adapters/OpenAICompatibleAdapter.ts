/**
 * OpenAI-Compatible Adapter
 *
 * Adapter implementation providers for AI that support the OpenAI API format.
 * This includes: OpenAI, DeepSeek, Alibaba, Zhipu, MiniMax, Grok, and Gemini.
 */

import { OpenAI } from 'openai';
import { AIProviderAdapter, ChatRequest, ChatResponse, APIError, ConfigError, StreamHandler } from '../types/adapter';
import type { AIProviderId } from '../types/aiProvider';
import { PROVIDER_CATALOG } from '../config/aiCatalog';
import { getApiKey } from '../lib/aiKeyManager';

/**
 * Configuration options for the OpenAI-compatible adapter
 */
export interface OpenAICompatibleAdapterConfig {
  provider: AIProviderId;
  apiBase?: string;
  apiKey?: string;
}

/**
 * OpenAI-compatible API adapter
 *
 * Handles communication with AI providers that implement the OpenAI API format.
 * This adapter supports providers like:
 * - OpenAI (https://api.openai.com/v1)
 * - DeepSeek (https://api.deepseek.com/v1)
 * - Alibaba DashScope (https://dashscope.aliyuncs.com/compatible-mode/v1)
 * - Zhipu AI (https://open.bigmodel.cn/api/paas/v4)
 * - MiniMax (https://api.minimax.chat/v1)
 * - Grok (https://api.x.ai/v1)
 */
export class OpenAICompatibleAdapter implements AIProviderAdapter {
  readonly providerId: AIProviderId;
  private client: OpenAI | null = null;
  private config: OpenAICompatibleAdapterConfig;

  constructor(config: OpenAICompatibleAdapterConfig) {
    this.providerId = config.provider;
    this.config = config;
    this.initializeClient();
  }

  /**
   * Initialize the OpenAI client with the provided configuration
   */
  private initializeClient(): void {
    const providerConfig = PROVIDER_CATALOG[this.providerId];
    
    if (!providerConfig) {
      console.warn(`[OpenAICompatibleAdapter] Unknown provider: ${this.providerId}`);
      return;
    }

    // Get API key from config or use provided one
    const apiKey = this.config.apiKey ?? this.getApiKeyFromSource();

    if (!apiKey) {
      console.warn(`[OpenAICompatibleAdapter] No API key available for provider: ${this.providerId}`);
      this.client = null;
      return;
    }

    const apiBase = this.config.apiBase ?? providerConfig.apiBase;

    if (!apiBase) {
      console.warn(`[OpenAICompatibleAdapter] No API base URL for provider: ${this.providerId}`);
      this.client = null;
      return;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: apiBase,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Get API key from configured source (localStorage or environment)
   */
  private getApiKeyFromSource(): string | undefined {
    const keySource = getApiKey(this.providerId);
    
    if (keySource.source === 'none' || !keySource.key) {
      return undefined;
    }

    console.log(`[OpenAICompatibleAdapter] Using API key from source: ${keySource.source}`);
    return keySource.key;
  }

  /**
   * Send a chat request using the OpenAI-compatible API
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.client) {
      throw new ConfigError(
        `Adapter not configured for provider: ${this.providerId}`,
        undefined,
        this.providerId
      );
    }

    try {
      console.log(`[OpenAICompatibleAdapter] Sending chat request to ${this.providerId}`);

      const completion = await this.client.chat.completions.create({
        model: request.model,
        messages: request.messages.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        temperature: request.temperature ?? 0.8,
        max_tokens: request.maxTokens ?? 1000,
        top_p: request.topP ?? 0.9,
      });

      const choice = completion.choices[0];
      const message = choice?.message;
      const finishReason = this.mapFinishReason(choice?.finish_reason);

      const response: ChatResponse = {
        content: message?.content ?? '',
        finishReason,
        provider: this.providerId,
        model: completion.model,
      };

      if (completion.usage) {
        response.usage = {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        };
      }

      console.log(`[OpenAICompatibleAdapter] Received response from ${this.providerId}`);
      return response;
    } catch (error) {
      console.error(`[OpenAICompatibleAdapter] Error calling ${this.providerId}:`, error);
      
      // Check for OpenAI SDK errors by checking for common error properties
      if (error && typeof error === 'object' && 'status' in error) {
        const openaiError = error as { status?: number; message?: string };
        const status = openaiError.status;
        const isRetryable = status !== undefined && [429, 500, 502, 503, 504].includes(status);
        
        throw new APIError(
          openaiError.message ?? 'API error occurred',
          status,
          this.providerId,
          isRetryable
        );
      }

      // Check for authentication errors
      if (error instanceof OpenAI.AuthenticationError) {
        throw new APIError(
          'Authentication failed. Please check your API key.',
          401,
          this.providerId,
          false
        );
      }

      // Check for rate limit errors
      if (error instanceof OpenAI.RateLimitError) {
        throw new APIError(
          'Rate limit exceeded. Please try again later.',
          429,
          this.providerId,
          true
        );
      }

      // Check for connection errors
      if (error instanceof OpenAI.APIConnectionError) {
        throw new APIError(
          'Failed to connect to API. Please check your network.',
          undefined,
          this.providerId,
          true
        );
      }

      // Generic error
      throw new APIError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        undefined,
        this.providerId,
        true
      );
    }
  }

  /**
   * Map OpenAI finish reason to our format
   */
  private mapFinishReason(
    reason: string | null | undefined
  ): 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'unknown' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'unknown';
    }
  }

  /**
   * Send a streaming chat request using the OpenAI-compatible API
   */
  async chatStream(request: ChatRequest, onChunk: StreamHandler): Promise<void> {
    if (!this.client) {
      throw new ConfigError(
        `Adapter not configured for provider: ${this.providerId}`,
        undefined,
        this.providerId
      );
    }

    try {
      console.log(`[OpenAICompatibleAdapter] Sending streaming chat request to ${this.providerId}`);

      const stream = await this.client.chat.completions.create({
        model: request.model,
        messages: request.messages.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        temperature: request.temperature ?? 0.8,
        max_tokens: request.maxTokens ?? 1000,
        top_p: request.topP ?? 0.9,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        
        onChunk({
          delta,
          done: chunk.choices[0]?.finish_reason !== null,
          model: chunk.model,
        });
      }

      console.log(`[OpenAICompatibleAdapter] Streaming completed for ${this.providerId}`);
    } catch (error) {
      console.error(`[OpenAICompatibleAdapter] Streaming error for ${this.providerId}:`, error);
      
      // Check for OpenAI SDK errors
      if (error && typeof error === 'object' && 'status' in error) {
        const openaiError = error as { status?: number; message?: string };
        const status = openaiError.status;
        const isRetryable = status !== undefined && [429, 500, 502, 503, 504].includes(status);
        
        throw new APIError(
          openaiError.message ?? 'API streaming error occurred',
          status,
          this.providerId,
          isRetryable
        );
      }

      // Check for specific error types
      if (error instanceof OpenAI.AuthenticationError) {
        throw new APIError(
          'Authentication failed. Please check your API key.',
          401,
          this.providerId,
          false
        );
      }

      if (error instanceof OpenAI.RateLimitError) {
        throw new APIError(
          'Rate limit exceeded. Please try again later.',
          429,
          this.providerId,
          true
        );
      }

      if (error instanceof OpenAI.APIConnectionError) {
        throw new APIError(
          'Failed to connect to API. Please check your network.',
          undefined,
          this.providerId,
          true
        );
      }

      // Generic error
      throw new APIError(
        error instanceof Error ? error.message : 'Unknown streaming error occurred',
        undefined,
        this.providerId,
        true
      );
    }
  }

  /**
   * Check if the adapter is properly configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Validate the API key
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey || !apiKey.trim()) {
      return false;
    }

    try {
      const testClient = new OpenAI({
        apiKey: apiKey.trim(),
        baseURL: this.config.apiBase ?? PROVIDER_CATALOG[this.providerId].apiBase,
        dangerouslyAllowBrowser: true,
      });

      // Try to list models as a quick validation
      await testClient.models.list();
      return true;
    } catch {
      console.warn(`[OpenAICompatibleAdapter] API key validation failed for ${this.providerId}`);
      return false;
    }
  }
}
