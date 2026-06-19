/**
 * Alibaba DashScope Adapter
 *
 * Adapter for Alibaba's Qwen models using the OpenAI-compatible API format.
 */

import { OpenAICompatibleAdapter } from './OpenAICompatibleAdapter.js';
import { PROVIDER_CATALOG } from '../config/aiCatalog.js';

/**
 * Alibaba DashScope Adapter
 *
 * Provides access to Alibaba's Qwen models including:
 * - qwen3-max
 * - qwen-plus
 * - qwen-flash
 */
export class AlibabaAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      provider: 'alibaba',
      apiBase: PROVIDER_CATALOG.alibaba.apiBase,
    });
  }
}
