import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  emotionStorage,
  preferencesStorage,
  privacyService,
  initializeStorage,
  DEFAULT_PREFERENCES
} from '../services/storageService';
import type {
  EmotionRecord,
  UserPreferences,
  StorageMetadata
} from '../types/storage';
import type { Conversation } from '../types';

interface AppState {
  // 状态
  emotionHistory: EmotionRecord[];
  preferences: UserPreferences;
  isLoading: boolean;
  storageStats: {
    emotionCount: number;
    storageSize: string;
  } | null;

  // Actions - 初始化
  initializeApp: () => Promise<void>;

  // Actions - 情绪历史
  addEmotionRecord: (record: Omit<EmotionRecord, 'id' | 'timestamp'>) => Promise<EmotionRecord>;
  updateEmotionRecord: (id: string, updates: Partial<Omit<EmotionRecord, 'id' | 'timestamp'>>) => Promise<EmotionRecord | null>;
  deleteEmotionRecord: (id: string) => Promise<boolean>;
  getRecentEmotions: (limit: number) => Promise<EmotionRecord[]>;

  // Actions - 用户偏好
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;

  // Actions - 隐私功能
  exportAllData: () => Promise<{
    version: string;
    exportDate: string;
    emotions: EmotionRecord[];
    chats: Conversation[];
    preferences: UserPreferences;
    metadata: StorageMetadata;
  }>;
  deleteAllData: () => Promise<void>;
  loadStorageStats: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // 初始状态
    emotionHistory: [],
    preferences: DEFAULT_PREFERENCES,
    isLoading: true,
    storageStats: null,

    // 初始化
    initializeApp: async () => {
      try {
        // 初始化存储
        await initializeStorage();

        // 并行加载数据
        const [emotions, preferences] = await Promise.all([
          emotionStorage.getAll(),
          preferencesStorage.get()
        ]);

        set({
          emotionHistory: emotions.sort((a, b) => b.timestamp - a.timestamp),
          preferences,
          isLoading: false
        });

        // 加载存储统计
        await get().loadStorageStats();
      } catch (error) {
        console.error('Failed to initialize app:', error);
        set({ isLoading: false });
      }
    },

    // 情绪历史
    addEmotionRecord: async (record) => {
      const newRecord = await emotionStorage.add(record)
      
      set(state => ({
        emotionHistory: [newRecord, ...state.emotionHistory]
      }))

      // 更新存储统计
      await get().loadStorageStats()
      
      return newRecord
    },

    updateEmotionRecord: async (id: string, updates: Record<string, unknown>) => {
      const updated = await emotionStorage.update(id, updates)
      
      if (updated) {
        set(state => ({
          emotionHistory: state.emotionHistory.map(r =>
            r.id === id ? updated : r
          )
        }))
        await get().loadStorageStats()
      }
      
      return updated
    },

    deleteEmotionRecord: async (id: string) => {
      const success = await emotionStorage.delete(id)
      
      if (success) {
        set(state => ({
          emotionHistory: state.emotionHistory.filter(r => r.id !== id)
        }))
        await get().loadStorageStats()
      }
      
      return success
    },

    getRecentEmotions: async (limit: number) => {
      return await emotionStorage.getRecent(limit)
    },

    // 用户偏好
    updatePreferences: async (updates) => {
      const newPreferences = await preferencesStorage.update(updates);
      set({ preferences: newPreferences });
    },

    resetPreferences: async () => {
      const defaultPrefs = await preferencesStorage.reset();
      set({ preferences: defaultPrefs });
    },

    // 隐私功能
    exportAllData: async () => {
      return await privacyService.exportAllData();
    },

    deleteAllData: async () => {
      await privacyService.deleteAllData();

      set({
        emotionHistory: [],
        preferences: DEFAULT_PREFERENCES,
        storageStats: {
          emotionCount: 0,
          storageSize: '0 KB'
        }
      });
    },

    loadStorageStats: async () => {
      const stats = await privacyService.getStorageStats();
      set({
        storageStats: {
          emotionCount: stats.emotionCount,
          storageSize: stats.storageSize
        }
      });
    }
  }))
);
