import type { AIProviderId, ApiKeySource } from '../types/aiProvider';
import { PROVIDER_CATALOG } from '../config/aiCatalog';

const STORAGE_KEY = 'mindspace-ai-config';

interface StoredConfig {
  selectedProvider: AIProviderId;
  customApiKeys: Partial<Record<AIProviderId, string>>;
  defaultModels: Partial<Record<AIProviderId, string>>;
}

function getStoredConfig(): StoredConfig {
  if (typeof window === 'undefined') {
    return {
      selectedProvider: 'alibaba',
      customApiKeys: {},
      defaultModels: {}
    };
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[AI Key Manager] 读取配置失败:', error);
  }
  
  return {
    selectedProvider: 'alibaba',
    customApiKeys: {},
    defaultModels: {}
  };
}

export function getApiKey(provider: AIProviderId): ApiKeySource {
  const providerConfig = PROVIDER_CATALOG[provider];

  // Check localStorage customApiKeys from mindspace-ai-config
  const config = getStoredConfig();
  const localKey = config.customApiKeys?.[provider];
  
  if (localKey?.trim()) {
    return {
      key: localKey.trim(),
      source: 'localStorage'
    };
  }

  // Second: check environment variables
  const envVarName = providerConfig.envVarName;
  const envKey = import.meta.env[envVarName];
  
  if (envKey?.trim()) {
    return {
      key: envKey.trim(),
      source: 'env'
    };
  }

  // Third: no key available
  return {
    key: '',
    source: 'none'
  };
}

export function maskApiKey(key: string): string {
  if (!key || key.length <= 8) {
    return '***';
  }
  return `${key.substring(0, 8)}...`;
}

export async function validateApiKey(provider: AIProviderId, apiKey: string): Promise<boolean> {
  if (!apiKey?.trim()) {
    return false;
  }

  try {
    let testUrl: string;
    let headers: Record<string, string> = {};

    switch (provider) {
      case 'openai':
        testUrl = 'https://api.openai.com/v1/models';
        headers = {
          'Authorization': `Bearer ${apiKey}`
        };
        break;

      case 'zhipu':
        testUrl = 'https://open.bigmodel.cn/api/paas/v4/models';
        headers = {
          'Authorization': `Bearer ${apiKey}`
        };
        break;

      case 'grok':
        testUrl = 'https://api.x.ai/v1/models';
        headers = {
          'Authorization': `Bearer ${apiKey}`
        };
        break;

      case 'deepseek':
        testUrl = 'https://api.deepseek.com/v1/models';
        headers = {
          'Authorization': `Bearer ${apiKey}`
        };
        break;

      case 'minimax':
        testUrl = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        };
        // MiniMax 没有 /models 端点，用简单的 chat completion 调用来验证
        const response = await fetch(testUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: 'MiniMax-M2.1',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5
          })
        });
        if (response.ok || response.status === 400) {
          // 400 可能是内容过滤，但 key 是有效的
          console.log(`[AI Key Manager] ${provider} key validation: success`);
          return true;
        }
        if (response.status === 401 || response.status === 403) {
          console.log(`[AI Key Manager] ${provider} key validation: failed (invalid key)`);
          return false;
        }
        console.log(`[AI Key Manager] ${provider} key validation: failed (status ${response.status})`);
        return false;

      case 'alibaba':
        testUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/models';
        headers = {
          'Authorization': `Bearer ${apiKey}`
        };
        break;

      default:
        return false;
    }

    const response = await fetch(testUrl, {
      method: 'GET',
      headers
    });

    if (response.ok) {
      console.log(`[AI Key Manager] ${provider} key validation: success`);
      return true;
    }

    if (response.status === 401 || response.status === 403) {
      console.log(`[AI Key Manager] ${provider} key validation: failed (invalid key)`);
      return false;
    }

    console.log(`[AI Key Manager] ${provider} key validation: failed (status ${response.status})`);
    return false;
  } catch (error) {
    console.error(`[AI Key Manager] ${provider} key validation: error`, error);
    return false;
  }
}

export function isProviderConfigured(provider: AIProviderId): boolean {
  // All catalog providers require an API key.
  if (!PROVIDER_CATALOG[provider]) {
    return false;
  }

  const { key } = getApiKey(provider);

  return !!key;
}
