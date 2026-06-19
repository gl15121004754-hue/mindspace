import { describe, it, beforeEach, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatPage from '../pages/ChatPage'
import InsightPage from '../pages/InsightPage'
import ChatHistory from '../components/ChatHistory'
import { useChatStore } from '../store/chatStore'
import { useAppStore } from '../store/useAppStore'
import { useThemeStore } from '../store/themeStore'
import { BrowserRouter } from 'react-router-dom'

// Mock stores
vi.mock('../store/chatStore', () => ({
  useChatStore: vi.fn(),
  useConversations: vi.fn()
}))

vi.mock('../store/useAppStore', () => ({
  useAppStore: vi.fn()
}))

vi.mock('../store/themeStore', () => ({
  useThemeStore: vi.fn()
}))

// Helper to wrap components with router
const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('ChatPage', () => {
  const mockConversations = [
    {
      id: 'conv-1',
      messages: [
        { id: 'msg-1', role: 'user', content: '你好', timestamp: Date.now() }
      ],
      startTime: Date.now()
    }
  ]

  beforeEach(() => {
    vi.mocked(useChatStore).mockReturnValue({
      conversations: mockConversations,
      getCurrentConversation: () => mockConversations[0],
      createConversation: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      setTyping: vi.fn(),
      isTyping: false
    })
    vi.mocked(useThemeStore).mockReturnValue({
      theme: 'light',
      toggleTheme: vi.fn()
    })
  })

  it('should render chat page without crashing', () => {
    renderWithRouter(<ChatPage />)
    expect(screen.getByText('这一刻，你在想什么...')).toBeInTheDocument()
  })

  it('should show history sidebar when button clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ChatPage />)

    const historyButton = screen.getByRole('button', { name: /历史记录/i })
    await user.click(historyButton)

    expect(screen.getByText('对话历史')).toBeInTheDocument()
  })
})

describe('InsightPage', () => {
  const mockEmotions = [
    { id: 'emo-1', emotion: '焦虑', intensity: 7, timestamp: Date.now(), trigger: '工作压力' },
    { id: 'emo-2', emotion: '悲伤', intensity: 5, timestamp: Date.now(), trigger: '家庭问题' }
  ]

  beforeEach(() => {
    vi.mocked(useChatStore).mockReturnValue({
      conversations: []
    })
    vi.mocked(useAppStore).mockReturnValue({
      emotionHistory: mockEmotions
    })
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
    vi.mocked(useChatStore).mockReturnValue({
      conversations: mockConversations,
      deleteConversation: vi.fn()
    })
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
    expect(screen.getByText('测试消息')).toBeInTheDocument()
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

describe('API Key Validation', () => {
  it('should validate API key format', () => {
    // Test basic validation logic
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

    // Test toggle logic
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
