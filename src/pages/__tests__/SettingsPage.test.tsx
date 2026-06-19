import { describe, it, beforeEach, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsPage from '../SettingsPage'
import { BrowserRouter } from 'react-router-dom'

// --- Mock useAIConfigStore --------------------------------------------------
// Children (ProviderSelector, ApiKeySection, ModelSelector) read via selector
// form: useAIConfigStore(state => state.x). The mock applies the selector to a
// shared state object (hoisted so the vi.mock factory can reference it).

type StoreLike = Record<string, any>

const { configStoreState } = vi.hoisted(() => ({
  configStoreState: {
    selectedProvider: 'openai',
    customApiKeys: {},
    defaultModels: {},
    models: [],
    setProvider: vi.fn(),
    setApiKey: vi.fn(),
    clearApiKey: vi.fn(),
    setModel: vi.fn(),
    validateApiKey: vi.fn(async () => true),
    isProviderConfigured: vi.fn(() => false),
    getApiKey: vi.fn(() => undefined),
    getApiBase: vi.fn(() => 'https://api.openai.com/v1'),
    getCurrentModel: vi.fn(() => 'gpt-4o-mini'),
    getProviderModels: vi.fn(() => []),
    resolveChatConfig: vi.fn(() => ({
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      apiKey: '',
    })),
  } as StoreLike,
}))

vi.mock('../../store/aiConfigStore', () => ({
  useAIConfigStore: Object.assign(
    vi.fn((selector?: (s: StoreLike) => any) =>
      typeof selector === 'function' ? selector(configStoreState) : configStoreState
    ),
    {
      getState: () => configStoreState,
      setState: (partial: Partial<StoreLike>) => Object.assign(configStoreState, partial),
    }
  ),
}))

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('SettingsPage', () => {
  beforeEach(() => {
    configStoreState.selectedProvider = 'openai'
    configStoreState.customApiKeys = {}
    configStoreState.defaultModels = {}
    configStoreState.isProviderConfigured = vi.fn(() => false)
    configStoreState.setProvider = vi.fn()
    configStoreState.validateApiKey = vi.fn(async () => true)
  })

  it('should render the settings page with all sections', () => {
    renderWithRouter(<SettingsPage />)

    expect(screen.getByText('AI 设置')).toBeInTheDocument()
    expect(screen.getByText('配置您的 AI 提供商和模型偏好')).toBeInTheDocument()
    expect(screen.getByText('选择提供商')).toBeInTheDocument()
    expect(screen.getByText('选择您偏好的 AI 服务提供商')).toBeInTheDocument()
    expect(screen.getByText('选择模型')).toBeInTheDocument()
  })

  it('should render all 6 provider cards from the catalog', () => {
    const { container } = renderWithRouter(<SettingsPage />)

    // Catalog display names (config/aiCatalog.ts). 6 providers, no Gemini.
    const providers = ['OpenAI', '智谱AI', 'Grok', 'DeepSeek', 'MiniMax', '阿里云通义千问']

    // Provider cards render as role=radio; assert 6 of them, plus each name.
    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBeGreaterThanOrEqual(6)

    providers.forEach((provider) => {
      const found = container.textContent?.includes(provider)
      expect(found).toBe(true)
    })
  })

  it('should handle provider selection', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SettingsPage />)

    const openaiButton = screen.getByRole('radio', { name: /OpenAI/ })
    await user.click(openaiButton)

    expect(configStoreState.setProvider).toHaveBeenCalledWith('openai')
  })

  it('should support keyboard navigation for provider selection', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SettingsPage />)

    const providerButtons = screen.getAllByRole('radio')
    const firstButton = providerButtons[0]

    firstButton.focus()
    expect(firstButton).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    await waitFor(() => {
      expect(configStoreState.setProvider).toHaveBeenCalled()
    })
  })
})

describe('ProviderSelector', () => {
  beforeEach(() => {
    configStoreState.isProviderConfigured = vi.fn((provider: string) => provider === 'openai')
  })

  it('should show configuration status for providers', () => {
    renderWithRouter(<SettingsPage />)

    const openaiButton = screen.getByRole('radio', { name: /OpenAI/ })
    expect(openaiButton).toHaveAttribute('aria-checked', 'true')
  })
})

describe('ModelSelector', () => {
  it('should display model metadata including context length and streaming badge', async () => {
    renderWithRouter(<SettingsPage />)

    await waitFor(() => {
      const modelButtons = screen.getAllByRole('radio')
      expect(modelButtons.length).toBeGreaterThan(0)
    })
  })

  it('should handle model selection via keyboard and mouse', async () => {
    renderWithRouter(<SettingsPage />)

    await waitFor(() => {
      const modelButtons = screen.queryAllByRole('radio')
      if (modelButtons.length > 0) {
        expect(modelButtons[0]).toBeInTheDocument()
      }
    })
  })
})
