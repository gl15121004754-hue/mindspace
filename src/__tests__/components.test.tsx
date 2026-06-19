import { describe, it, beforeEach, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatPage from '../pages/ChatPage'
import InsightPage from '../pages/InsightPage'
import ChatHistory from '../components/ChatHistory'
import { BrowserRouter } from 'react-router-dom'

// --- Mock stores ------------------------------------------------------------
// Components read state via selector form: useChatStore(state => state.x).
// The mock must accept an optional selector and apply it to the full store
// object; when called with no selector it returns the whole store. It must
// also expose .getState() (used by ChatPage/ChatHistory for one-off reads)
// and .setState() (used by ChatPage to set currentConversationId).
//
// vi.mock factories are hoisted above imports, so the shared state objects
// are created with vi.hoisted — that makes them available both inside the
// factories and in the beforeEach blocks below.

type StoreLike = Record<string, any>

function createSelectorStore(store: StoreLike) {
  const fn = vi.fn((selector?: (s: StoreLike) => any) =>
    typeof selector === 'function' ? selector(store) : store
  )
  ;(fn as any).getState = () => store
  ;(fn as any).setState = (partial: Partial<StoreLike>) => {
    Object.assign(store, partial)
  }
  return fn as any
}

const { chatStoreState, appStoreState, themeStoreState } = vi.hoisted(() => ({
  chatStoreState: {
    conversations: [],
    currentConversationId: null,
    isTyping: false,
    getCurrentConversation: () => null,
    createConversation: () => {},
    addMessage: () => {},
    updateMessage: () => {},
    deleteConversation: () => {},
    setTyping: () => {},
    clearAllConversations: () => {},
    exportConversation: () => '',
  } as StoreLike,
  appStoreState: {
    emotionHistory: [],
    preferences: {},
    isLoading: false,
    storageStats: null,
    initializeApp: async () => {},
    loadStorageStats: async () => {},
  } as StoreLike,
  themeStoreState: {
    theme: 'light',
    toggleTheme: () => {},
  } as StoreLike,
}))

vi.mock('../store/chatStore', () => ({
  useChatStore: createSelectorStore(chatStoreState),
  useConversations: () => chatStoreState.conversations,
}))

vi.mock('../store/useAppStore', () => ({
  useAppStore: createSelectorStore(appStoreState),
}))

vi.mock('../store/themeStore', () => ({
  useThemeStore: createSelectorStore(themeStoreState),
}))

// Helper to wrap components with router
const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

// --- ChatPage ---------------------------------------------------------------

describe('ChatPage', () => {
  const mockConversation = {
    id: 'conv-1',
    messages: [
      { id: 'msg-1', role: 'user', content: '你好', timestamp: Date.now() }
    ],
    startTime: Date.now()
  }

  beforeEach(() => {
    chatStoreState.conversations = [mockConversation]
    chatStoreState.currentConversationId = 'conv-1'
    chatStoreState.isTyping = false
    chatStoreState.getCurrentConversation = () => mockConversation
    chatStoreState.createConversation = vi.fn()
    chatStoreState.addMessage = vi.fn()
    chatStoreState.updateMessage = vi.fn()
    chatStoreState.setTyping = vi.fn()
  })

  it('should render chat page without crashing', () => {
    renderWithRouter(<ChatPage />)
    // The header history button carries a badge of the conversation count.
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('should show history sidebar when button clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ChatPage />)

    // The history button has no accessible name (icon-only); target it via its
    // container, then click. The conversation-count badge (1) sits on it.
    const historyButton = screen.getByText('1').closest('button')!
    await user.click(historyButton)

    expect(screen.getByText('对话历史')).toBeInTheDocument()
  })
})

// --- InsightPage ------------------------------------------------------------

describe('InsightPage', () => {
  const mockEmotions = [
    { id: 'emo-1', emotion: '焦虑', intensity: 7, timestamp: Date.now(), trigger: '工作压力' },
    { id: 'emo-2', emotion: '悲伤', intensity: 5, timestamp: Date.now(), trigger: '家庭问题' }
  ]

  beforeEach(() => {
    chatStoreState.conversations = []
    appStoreState.emotionHistory = mockEmotions as any
    appStoreState.isLoading = false
  })

  it('should render insight page without crashing', () => {
    renderWithRouter(<InsightPage />)
    expect(screen.getByText('情绪洞察')).toBeInTheDocument()
  })

  it('should show stats cards when data exists', () => {
    renderWithRouter(<InsightPage />)
    expect(screen.getByText('对话次数')).toBeInTheDocument()
    expect(screen.getByText('情绪记录')).toBeInTheDocument()
  })
})

// --- ChatHistory ------------------------------------------------------------

describe('ChatHistory', () => {
  const mockConversations = [
    {
      id: 'conv-1',
      messages: [
        { id: 'msg-1', role: 'user', content: '测试消息', timestamp: Date.now() }
      ],
      startTime: Date.now()
    }
  ]

  beforeEach(() => {
    chatStoreState.conversations = mockConversations
    chatStoreState.deleteConversation = vi.fn()
  })

  it('should render conversation list', () => {
    renderWithRouter(
      <ChatHistory
        isOpen={true}
        onClose={() => {}}
        onSelectConversation={() => {}}
      />
    )
    expect(screen.getByText('对话历史')).toBeInTheDocument()
    // The preview truncates the first user message and appends '...'.
    expect(screen.getByText('测试消息...')).toBeInTheDocument()
  })

  it('should close when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    renderWithRouter(
      <ChatHistory
        isOpen={true}
        onClose={onClose}
        onSelectConversation={() => {}}
      />
    )

    const closeButton = screen.getByRole('button', { name: /关闭历史记录/i })
    await user.click(closeButton)

    expect(onClose).toHaveBeenCalled()
  })
})

// --- Pure-logic tests (unchanged) ------------------------------------------

describe('API Key Validation', () => {
  it('should validate API key format', () => {
    const isValidKey = (key: string) => key.length >= 10 && key.startsWith('sk-')
    expect(isValidKey('sk-test123456789')).toBe(true)
    expect(isValidKey('short')).toBe(false)
    expect(isValidKey('not-starting-with-sk')).toBe(false)
  })
})

describe('Theme Store', () => {
  it('should toggle theme correctly', () => {
    const mockThemeStore = {
      theme: 'light',
      toggleTheme: vi.fn()
    }
    const newTheme = mockThemeStore.theme === 'light' ? 'dark' : 'light'
    expect(newTheme).toBe('dark')

    mockThemeStore.theme = 'dark'
    const anotherToggle = mockThemeStore.theme === 'light' ? 'dark' : 'light'
    expect(anotherToggle).toBe('light')
  })
})

describe('SOS Pages', () => {
  it('should handle emotion intensity mapping', () => {
    const intensityMap: Record<string, number> = {
      mild: 3,
      moderate: 5,
      severe: 8,
      extreme: 10
    }

    expect(intensityMap.mild).toBe(3)
    expect(intensityMap.extreme).toBe(10)
  })

  it('should handle countdown correctly', () => {
    const initialCountdown = 60
    const countdown = initialCountdown - 1

    expect(countdown).toBe(59)
    expect(countdown).toBeGreaterThan(0)
  })
})

describe('Privacy Settings', () => {
  it('should calculate storage stats correctly', () => {
    const mockStats = {
      emotionCount: 5,
      storageSize: '1.2 KB'
    }

    expect(mockStats.emotionCount).toBe(5)
    expect(mockStats.storageSize).toBe('1.2 KB')
  })
})
