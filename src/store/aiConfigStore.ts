import { create } from 'zustand';
import type { AIProviderId } from '../types/aiProvider';
import { DEFAULT_PROVIDER } from '../types/aiProvider';
import {
  PROVIDER_CATALOG,
  MODEL_REGISTRY,
  getProvider,
  resolveChatEndpoint,
  type AIModel,
} from '../config/aiCatalog';
import { validateApiKey as validateKey, isProviderConfigured as checkConfigured } from '../lib/aiKeyManager';

const STORAGE_KEY = 'mindspace-ai-config';

/**
 * Shape persisted to localStorage. Holds only the user's mutable choices:
 * selected provider, per-provider keys, and per-provider chosen model.
 */
interface StoredConfig {
  selectedProvider: AIProviderId;
  customApiKeys: Partial<Record<AIProviderId, string>>;
  /** The user's chosen model id per provider (effective selection). */
  defaultModels: Partial<Record<AIProviderId, string>>;
}

/** Everything the chat path needs behind one seam. */
export interface ChatConfig {
  apiUrl: string;
  model: string;
  apiKey: string;
  provider: AIProviderId;
}

interface AIConfigStore extends StoredConfig {
  // Derived state
  models: AIModel[];

  // Actions
  setProvider: (provider: AIProviderId) => void;
  setApiKey: (provider: AIProviderId, apiKey: string) => void;
  clearApiKey: (provider: AIProviderId) => void;
  setModel: (provider: AIProviderId, modelId: string) => void;
  validateApiKey: (provider: AIProviderId, apiKey: string) => Promise<boolean>;
  isProviderConfigured: (provider: AIProviderId) => boolean;

  // Getters — all read static data from the catalog, not a local copy.
  getApiKey: (provider: AIProviderId) => string | undefined;
  getApiBase: (provider: AIProviderId) => string | undefined;
  getCurrentModel: () => string;
  getProviderModels: (provider: AIProviderId) => AIModel[];
  /** Resolve everything the chat path needs, in one call. */
  resolveChatConfig: () => ChatConfig;
}

const loadFromStorage = (): StoredConfig & { models: AIModel[] } => {
  const fallback = {
    selectedProvider: DEFAULT_PROVIDER,
    customApiKeys: {},
    defaultModels: {},
    models: MODEL_REGISTRY.getAll(),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<StoredConfig>;
      return {
        selectedProvider: parsed.selectedProvider ?? DEFAULT_PROVIDER,
        customApiKeys: parsed.customApiKeys ?? {},
        defaultModels: parsed.defaultModels ?? {},
        models: MODEL_REGISTRY.getAll(),
      };
    }
  } catch (error) {
    console.error('Failed to load AI config from storage:', error);
  }

  return fallback;
};

const saveToStorage = (config: StoredConfig) => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save AI config to storage:', error);
  }
};

export const useAIConfigStore = create<AIConfigStore>((set, get) => {
  const initialConfig = loadFromStorage();

  return {
    ...initialConfig,

    setProvider: (provider) => {
      set({ selectedProvider: provider });
      saveToStorage({ ...get() });
    },

    setApiKey: (provider, apiKey) => {
      set((state) => ({
        customApiKeys: {
          ...state.customApiKeys,
          [provider]: apiKey,
        },
      }));
      saveToStorage({ ...get() });
    },

    clearApiKey: (provider) => {
      set((state) => {
        const newKeys = { ...state.customApiKeys };
        delete newKeys[provider];
        return { customApiKeys: newKeys };
      });
      saveToStorage({ ...get() });
    },

    setModel: (provider, modelId) => {
      set((state) => ({
        defaultModels: {
          ...state.defaultModels,
          [provider]: modelId,
        },
      }));
      saveToStorage({ ...get() });
    },

    validateApiKey: async (provider, apiKey) => validateKey(provider, apiKey),

    isProviderConfigured: (provider) => {
      return checkConfigured(provider);
    },

    getApiKey: (provider) => {
      return get().customApiKeys[provider];
    },

    getApiBase: (provider) => {
      return getProvider(provider)?.apiBase;
    },

    getCurrentModel: () => {
      const state = get();
      const provider = state.selectedProvider;
      // User's chosen model wins; otherwise the catalog default.
      return (
        state.defaultModels[provider] ?? PROVIDER_CATALOG[provider]?.defaultModel ?? ''
      );
    },

    getProviderModels: (provider) => {
      return MODEL_REGISTRY.getByProvider(provider);
    },

    resolveChatConfig: () => {
      const state = get();
      const provider = state.selectedProvider;
      const entry = PROVIDER_CATALOG[provider];
      const model =
        state.defaultModels[provider] ?? entry?.defaultModel ?? '';
      const apiKey = state.customApiKeys[provider]?.trim() ?? '';
      return {
        provider,
        apiUrl: resolveChatEndpoint(provider),
        model,
        apiKey,
      };
    },
  };
});

// Selector helpers for common use cases
export const selectCurrentProvider = (state: AIConfigStore) => state.selectedProvider;
export const selectCurrentModel = (state: AIConfigStore) => state.getCurrentModel();
export const selectHasApiKey = (provider: AIProviderId) => (state: AIConfigStore) =>
  !!state.getApiKey(provider);
