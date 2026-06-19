/**
 * AI Provider Catalog — the single static source of truth.
 *
 * Static (immutable) provider data lives here: metadata, the curated model
 * list, the per-provider default model, and endpoint derivation. Mutable
 * state (the user's selection + keys) lives in the zustand aiConfigStore.
 *
 * This module supersedes the four former catalog copies:
 *   - config/models.ts          (models only; merged here)
 *   - config/providers.ts       (deleted — divergent dead clone)
 *   - types/aiProvider.ts AI_PROVIDERS  (const moved here; type-level exports kept)
 *   - services/enhancedChatService.ts PROVIDER_CONFIG  (private, deleted)
 *
 * Curated list policy: stable, production-ready models only. Beta, preview,
 * experimental, and deprecated models are excluded:
 *   gpt-3.5-turbo, gemini-2.0-flash-exp, abab6 series / abab6.5s-chat, grok-beta,
 *   Hunyuan models.
 */

import type { AIProviderId } from '../types/aiProvider';

/**
 * Individual model configuration.
 */
export interface AIModel {
  id: string;
  name: string;
  provider: AIProviderId;
  contextLength: number;
  supportsStreaming: boolean;
}

/**
 * A provider's full static entry: metadata + its curated models.
 */
export interface ProviderEntry {
  id: AIProviderId;
  name: string;
  /** Base URL, e.g. 'https://api.openai.com/v1' (no trailing slash). */
  apiBase: string;
  /** VITE_* env var used as a built-in key fallback (e.g. SOS analysis). */
  envVarName: string;
  description: string;
  features: string[];
  /** Curated model list; order is significant — the first is the default. */
  models: AIModel[];
  /** Default model id. Always models[0].id by convention. */
  defaultModel: string;
}

const modelsFor = (
  provider: AIProviderId,
  defs: Array<[string, string, number]>
): AIModel[] =>
  defs.map(([id, name, contextLength]) => ({
    id,
    name,
    provider,
    contextLength,
    supportsStreaming: true,
  }));

/**
 * The catalog. apiBase values follow each provider's OpenAI-compatible root
 * (normalized — deepseek keeps its /v1). defaultModel is always models[0].id.
 */
export const PROVIDER_CATALOG: Record<AIProviderId, ProviderEntry> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    apiBase: 'https://api.openai.com/v1',
    envVarName: 'VITE_OPENAI_API_KEY',
    description: 'OpenAI GPT系列模型',
    features: ['多轮对话', '代码生成', '创意写作'],
    models: modelsFor('openai', [
      ['gpt-4o-mini', 'GPT-4o Mini', 128000],
      ['gpt-4o', 'GPT-4o', 128000],
    ]),
    defaultModel: 'gpt-4o-mini',
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱AI',
    apiBase: 'https://open.bigmodel.cn/api/paas/v4',
    envVarName: 'VITE_ZHIPU_API_KEY',
    description: '智谱清言GLM大模型',
    features: ['多轮对话', '知识问答', '文本创作'],
    models: modelsFor('zhipu', [
      ['glm-4.7', 'GLM-4.7', 200000],
      ['glm-4.7-flash', 'GLM-4.7 Flash', 200000],
      ['glm-4.6', 'GLM-4.6', 200000],
    ]),
    defaultModel: 'glm-4.7',
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    apiBase: 'https://api.x.ai/v1',
    envVarName: 'VITE_GROK_API_KEY',
    description: 'xAI Grok大模型',
    features: ['实时信息', '幽默对话', '深度思考'],
    models: modelsFor('grok', [
      ['grok-4', 'Grok-4', 131072],
      ['grok-4-fast', 'Grok-4 Fast', 131072],
    ]),
    defaultModel: 'grok-4',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    apiBase: 'https://api.deepseek.com/v1',
    envVarName: 'VITE_DEEPSEEK_API_KEY',
    description: 'DeepSeek推理大模型',
    features: ['代码生成', '数学推理', '深度分析'],
    models: modelsFor('deepseek', [
      ['deepseek-chat', 'DeepSeek Chat', 131072],
      ['deepseek-reasoner', 'DeepSeek Reasoner', 131072],
    ]),
    defaultModel: 'deepseek-chat',
  },
  alibaba: {
    id: 'alibaba',
    name: '阿里云通义千问',
    apiBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    envVarName: 'VITE_DASHSCOPE_API_KEY',
    description: '阿里云通义千问大模型',
    features: ['中文优化', '知识覆盖', '稳定可靠'],
    models: modelsFor('alibaba', [
      ['qwen-plus', 'Qwen Plus', 131072],
      ['qwen3-max', 'Qwen3 Max', 131072],
      ['qwen-flash', 'Qwen Flash', 131072],
    ]),
    defaultModel: 'qwen-plus',
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    apiBase: 'https://api.minimax.chat/v1',
    envVarName: 'VITE_MINIMAX_API_KEY',
    description: 'MiniMax海螺AI',
    features: ['快速响应', '多轮对话', '情感理解'],
    models: modelsFor('minimax', [
      ['MiniMax-M2.1', 'MiniMax-M2.1', 200000],
      ['MiniMax-M2.1-lightning', 'MiniMax-M2.1 Lightning', 200000],
    ]),
    defaultModel: 'MiniMax-M2.1',
  },
};

/** Stable display order for the catalog (drives UI rendering). */
export const PROVIDER_ORDER: AIProviderId[] = Object.keys(
  PROVIDER_CATALOG
) as AIProviderId[];

/**
 * Get a provider entry by id (undefined if unknown).
 */
export function getProvider(id: AIProviderId): ProviderEntry | undefined {
  return PROVIDER_CATALOG[id];
}

/**
 * All provider entries, in display order.
 */
export function getAllProviders(): ProviderEntry[] {
  return PROVIDER_ORDER.map((id) => PROVIDER_CATALOG[id]);
}

/**
 * Derive the full chat-completions endpoint from a provider's apiBase.
 * Single place that knows the '/chat/completions' suffix shape.
 */
export function resolveChatEndpoint(id: AIProviderId): string {
  const base = PROVIDER_CATALOG[id]?.apiBase;
  if (!base) return '';
  return `${base}/chat/completions`;
}

// ---------------------------------------------------------------------------
// MODEL_REGISTRY — query helpers over the catalog. UI (ModelSelector) and the
// store consume these; they keep call sites off the raw catalog shape.
// ---------------------------------------------------------------------------

function assertEntry(id: AIProviderId): ProviderEntry {
  const entry = PROVIDER_CATALOG[id];
  if (!entry) throw new Error(`Unknown provider: ${id}`);
  return entry;
}

export const MODEL_REGISTRY = {
  getByProvider: (provider: AIProviderId): AIModel[] => assertEntry(provider).models,

  getById: (provider: AIProviderId, modelId: string): AIModel | undefined =>
    PROVIDER_CATALOG[provider]?.models.find((m) => m.id === modelId),

  getAll: (): AIModel[] =>
    PROVIDER_ORDER.flatMap((id) => PROVIDER_CATALOG[id].models),

  has: (provider: AIProviderId, modelId: string): boolean =>
    MODEL_REGISTRY.getById(provider, modelId) !== undefined,

  getStreamingModels: (provider: AIProviderId): AIModel[] =>
    MODEL_REGISTRY.getByProvider(provider).filter((m) => m.supportsStreaming),

  getCount: (): number => MODEL_REGISTRY.getAll().length,

  getProviders: (): AIProviderId[] => [...PROVIDER_ORDER],
};

export function getModelsByProvider(provider: AIProviderId): AIModel[] {
  return MODEL_REGISTRY.getByProvider(provider);
}

export function getModelById(
  provider: AIProviderId,
  modelId: string
): AIModel | undefined {
  return MODEL_REGISTRY.getById(provider, modelId);
}

export function getAllModels(): AIModel[] {
  return MODEL_REGISTRY.getAll();
}

export function getAllModelIds(): string[] {
  return MODEL_REGISTRY.getAll().map((m) => m.id);
}

export function isValidModelForProvider(
  provider: AIProviderId,
  modelId: string
): boolean {
  return MODEL_REGISTRY.has(provider, modelId);
}
