import { get, set, del } from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';
import type {
  EmotionRecord,
  SOSRecord,
  UserPreferences,
  StorageMetadata
} from '../types/storage';
import type { Conversation } from '../types';
import { useChatStore } from '../store/chatStore';

// 存储键名定义
const STORAGE_KEYS = {
  EMOTIONS: 'mindspace_emotions',
  SOS_RECORDS: 'mindspace_sos_records',
  PREFERENCES: 'mindspace_preferences',
  METADATA: 'mindspace_metadata'
} as const;

// 默认配置
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  language: 'zh-CN',
  notifications: true,
  privacyMode: false,
  defaultView: 'home',
  aiPersonality: 'empathetic',
  autoSave: true
};

// ============ 情绪历史操作 ============

export const emotionStorage = {
  async getAll(): Promise<EmotionRecord[]> {
    return (await get<EmotionRecord[]>(STORAGE_KEYS.EMOTIONS)) || [];
  },

  async add(record: Omit<EmotionRecord, 'id' | 'timestamp'>): Promise<EmotionRecord> {
    const newRecord: EmotionRecord = {
      ...record,
      id: uuidv4(),
      timestamp: Date.now()
    };
    
    const all = await this.getAll();
    const updated = [...all, newRecord];
    await set(STORAGE_KEYS.EMOTIONS, updated);
    
    // 更新元数据
    await updateMetadata({ emotionCount: updated.length });
    
    return newRecord;
  },

  async delete(id: string): Promise<boolean> {
    const all = await this.getAll();
    const filtered = all.filter(r => r.id !== id);
    
    if (filtered.length === all.length) return false;
    
    await set(STORAGE_KEYS.EMOTIONS, filtered);
    await updateMetadata({ emotionCount: filtered.length });
    return true;
  },

  async update(id: string, updates: Partial<Omit<EmotionRecord, 'id' | 'timestamp'>>): Promise<EmotionRecord | null> {
    const all = await this.getAll();
    const index = all.findIndex(r => r.id === id);
    
    if (index === -1) return null;
    
    const updated = {
      ...all[index],
      ...updates
    };
    
    all[index] = updated;
    await set(STORAGE_KEYS.EMOTIONS, all);
    
    return updated;
  },

  async getByDateRange(startDate: number, endDate: number): Promise<EmotionRecord[]> {
    const all = await this.getAll();
    return all.filter(r => r.timestamp >= startDate && r.timestamp <= endDate);
  },

  async getRecent(limit: number): Promise<EmotionRecord[]> {
    const all = await this.getAll();
    return all
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },

  async clear(): Promise<void> {
    await del(STORAGE_KEYS.EMOTIONS);
    await updateMetadata({ emotionCount: 0 });
  }
};

// ============ SOS 记录操作 ============

export const sosStorage = {
  async getAll(): Promise<SOSRecord[]> {
    return (await get<SOSRecord[]>(STORAGE_KEYS.SOS_RECORDS)) || [];
  },

  async add(record: Omit<SOSRecord, 'id' | 'timestamp'>): Promise<SOSRecord> {
    const newRecord: SOSRecord = {
      ...record,
      id: uuidv4(),
      timestamp: Date.now()
    };
    
    const all = await this.getAll();
    await set(STORAGE_KEYS.SOS_RECORDS, [...all, newRecord]);
    return newRecord;
  },

  async getRecent(limit: number): Promise<SOSRecord[]> {
    const all = await this.getAll();
    return all
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
};

// ============ 用户偏好操作 ============

export const preferencesStorage = {
  async get(): Promise<UserPreferences> {
    return (await get<UserPreferences>(STORAGE_KEYS.PREFERENCES)) || DEFAULT_PREFERENCES;
  },

  async update(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.get();
    const updated = { ...current, ...updates };
    await set(STORAGE_KEYS.PREFERENCES, updated);
    return updated;
  },

  async reset(): Promise<UserPreferences> {
    await set(STORAGE_KEYS.PREFERENCES, DEFAULT_PREFERENCES);
    return DEFAULT_PREFERENCES;
  }
};

// ============ 元数据操作 ============

async function getMetadata(): Promise<StorageMetadata> {
  return (await get<StorageMetadata>(STORAGE_KEYS.METADATA)) || {
    version: '1.0',
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    emotionCount: 0,
    firstUseDate: Date.now()
  };
}

async function updateMetadata(updates: Partial<StorageMetadata>): Promise<void> {
  const metadata = await getMetadata();
  await set(STORAGE_KEYS.METADATA, {
    ...metadata,
    ...updates,
    lastUpdated: Date.now()
  });
}

// ============ 隐私功能 ============

export const privacyService = {
  async exportAllData(): Promise<{
    version: string;
    exportDate: string;
    emotions: EmotionRecord[];
    chats: Conversation[];
    preferences: UserPreferences;
    metadata: StorageMetadata;
  }> {
    const [emotions, preferences, metadata] = await Promise.all([
      emotionStorage.getAll(),
      preferencesStorage.get(),
      getMetadata()
    ]);

    // Chat history lives in useChatStore (localStorage); pull it in here so the
    // export is a complete backup. zustand getState() is synchronous.
    const chats = useChatStore.getState().conversations;

    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      emotions,
      chats,
      preferences,
      metadata
    };
  },

  async deleteAllData(): Promise<void> {
    await Promise.all([
      emotionStorage.clear(),
      del(STORAGE_KEYS.PREFERENCES)
    ]);

    await set(STORAGE_KEYS.METADATA, {
      version: '1.0',
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      emotionCount: 0,
      firstUseDate: Date.now()
    });

    // Clear chat history too, so "delete all data" is true to its name.
    useChatStore.getState().clearAllConversations();
  },

  async getStorageStats(): Promise<{
    emotionCount: number;
    storageSize: string;
    oldestRecord: number | null;
    newestRecord: number | null;
  }> {
    const [emotions, metadata] = await Promise.all([
      emotionStorage.getAll(),
      getMetadata()
    ]);

    const allTimestamps = emotions.map(e => e.timestamp);
    const oldest = allTimestamps.length > 0 ? Math.min(...allTimestamps) : null;
    const newest = allTimestamps.length > 0 ? Math.max(...allTimestamps) : null;

    // 估算存储大小
    const jsonString = JSON.stringify({ emotions, metadata });
    const size = new Blob([jsonString]).size;

    return {
      emotionCount: emotions.length,
      storageSize: formatBytes(size),
      oldestRecord: oldest,
      newestRecord: newest
    };
  }
};

// 辅助函数：格式化字节大小
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 初始化存储（首次使用时创建元数据）
export async function initializeStorage(): Promise<void> {
  const metadata = await getMetadata();
  if (!metadata.firstUseDate) {
    await updateMetadata({
      firstUseDate: Date.now()
    });
  }
}
