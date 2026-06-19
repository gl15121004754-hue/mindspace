/**
 * DeepSeek Adapter
 *
 * Adapter for DeepSeek's models using the OpenAI-compatible API format.
 */

import { OpenAICompatibleAdapter } from './OpenAICompatibleAdapter.js';
import { PROVIDER_CATALOG } from '../config/aiCatalog.js';

/**
 * DeepSeek Adapter
 *
 * Provides access to DeepSeek's models including:
 * - deepseek-chat
 * - deepseek-reasoner
 */
export class DeepSeekAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      provider: 'deepseek',
      apiBase: PROVIDER_CATALOG.deepseek.apiBase,
    });
  }
}
