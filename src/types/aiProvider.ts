/**
 * AI Provider Types
 *
 * Type-level definitions only. The static provider/model catalog lives in
 * `config/aiCatalog.ts` (the single source of truth). This module keeps the
 * widely-imported type-level exports — `AIProviderId`, `ApiKeySource`, and
 * `DEFAULT_PROVIDER` — so existing import sites need no change.
 */

export type AIProviderId =
  | 'openai'
  | 'zhipu'
  | 'grok'
  | 'deepseek'
  | 'minimax'
  | 'alibaba';

export interface ApiKeySource {
  key: string;
  source: 'localStorage' | 'env' | 'cloudbase-env' | 'none';
}

/**
 * Default provider (requires API key - more practical for users).
 */
export const DEFAULT_PROVIDER: AIProviderId = 'openai';
