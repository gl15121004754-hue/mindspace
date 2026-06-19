/**
 * Unit tests for privacyService — the first coverage for this module.
 *
 * Focus: exportAllData now includes chat history from useChatStore, and
 * deleteAllData now clears that chat history. Both depend on useChatStore,
 * which is mocked here. idb-keyval is mocked so no real IndexedDB is touched.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mocks ------------------------------------------------------------------
// chatStore: privacyService reads conversations + calls clearAllConversations.
const { chatStoreState } = vi.hoisted(() => ({
  chatStoreState: {
    conversations: [] as any[],
    clearAllConversations: vi.fn(() => {
      chatStoreState.conversations = [];
    }),
  },
}));

vi.mock('../../store/chatStore', () => ({
  useChatStore: {
    getState: () => chatStoreState,
  },
}));

// idb-keyval: stub all storage ops so no real IndexedDB is used.
const idbStore: Record<string, any> = {};
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => idbStore[key]),
  set: vi.fn(async (key: string, val: any) => {
    idbStore[key] = val;
  }),
  del: vi.fn(async (key: string) => {
    delete idbStore[key];
  }),
}));

// Import AFTER mocks are registered.
import { privacyService, emotionStorage } from '../storageService';

describe('privacyService.exportAllData', () => {
  beforeEach(() => {
    // Reset everything to a clean state.
    Object.keys(idbStore).forEach((k) => delete idbStore[k]);
    chatStoreState.conversations = [];
    chatStoreState.clearAllConversations = vi.fn(() => {
      chatStoreState.conversations = [];
    });
  });

  it('includes chat history from useChatStore in the export', async () => {
    // Seed some emotions into IndexedDB and some conversations into the store.
    await emotionStorage.add({
      emotion: 'anxiety',
      intensity: 6,
      trigger: 'test',
      copingMethod: 'chat',
    } as any);
    chatStoreState.conversations = [
      {
        id: 'conv-1',
        messages: [{ id: 'm1', role: 'user', content: '我有点焦虑', timestamp: Date.now() }],
        startTime: Date.now(),
      },
    ];

    const exported = await privacyService.exportAllData();

    expect(exported).toHaveProperty('chats');
    expect(exported.chats).toHaveLength(1);
    expect(exported.chats[0].id).toBe('conv-1');
    expect(exported.chats[0].messages[0].content).toBe('我有点焦虑');
    // Other fields still present.
    expect(exported).toHaveProperty('emotions');
    expect(exported).toHaveProperty('preferences');
    expect(exported).toHaveProperty('metadata');
    expect(exported.emotions).toHaveLength(1);
  });

  it('returns an empty chats array when there is no chat history', async () => {
    const exported = await privacyService.exportAllData();
    expect(exported.chats).toEqual([]);
  });
});

describe('privacyService.deleteAllData', () => {
  beforeEach(() => {
    Object.keys(idbStore).forEach((k) => delete idbStore[k]);
    chatStoreState.conversations = [];
    chatStoreState.clearAllConversations = vi.fn(() => {
      chatStoreState.conversations = [];
    });
  });

  it('clears chat history (calls useChatStore.clearAllConversations)', async () => {
    // Seed chats + emotions.
    chatStoreState.conversations = [
      { id: 'conv-1', messages: [], startTime: Date.now() },
    ];
    await emotionStorage.add({ emotion: 'sadness', intensity: 4 } as any);

    await privacyService.deleteAllData();

    // clearAllConversations was invoked.
    expect(chatStoreState.clearAllConversations).toHaveBeenCalledTimes(1);
  });

  it('still clears IndexedDB emotions', async () => {
    await emotionStorage.add({ emotion: 'anger', intensity: 8 } as any);
    expect(await emotionStorage.getAll()).toHaveLength(1);

    await privacyService.deleteAllData();

    expect(await emotionStorage.getAll()).toHaveLength(0);
  });
});
