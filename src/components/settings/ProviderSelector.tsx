import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAIConfigStore } from '../../store/aiConfigStore'
import { getAllProviders } from '../../config/aiCatalog'
import type { AIProviderId } from '../../types/aiProvider'

const PROVIDER_ICONS: Record<AIProviderId, JSX.Element> = {
  openai: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.0993 3.8558L12.6 8.3827l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zM21.4349 9.8259l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.892 10.3274V7.9949a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6842 4.6791zM8.3065 13.4091l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.6013a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.981a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  ),
  zhipu: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  grok: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  ),
  deepseek: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  ),
  minimax: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  alibaba: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  ),
}

const ProviderSelector: React.FC = () => {
  const selectedProvider = useAIConfigStore((state) => state.selectedProvider)
  const setProvider = useAIConfigStore((state) => state.setProvider)
  const isProviderConfigured = useAIConfigStore((state) => state.isProviderConfigured)
  const prevProviderRef = useRef<AIProviderId | null>(null)

  const providers = getAllProviders()

  const handleProviderClick = (providerId: AIProviderId) => {
    setProvider(providerId)
  }

  useEffect(() => {
    if (selectedProvider !== prevProviderRef.current) {
      const button = document.querySelector(`[data-provider="${selectedProvider}"]`) as HTMLButtonElement
      button?.focus()
      prevProviderRef.current = selectedProvider
    }
  }, [selectedProvider])

  const handleKeyDown = (e: React.KeyboardEvent, providerId: AIProviderId) => {
    const providerIds = providers.map(p => p.id)
    const currentIndex = providerIds.indexOf(providerId)

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        const nextIndex = (currentIndex + 1) % providerIds.length
        setProvider(providerIds[nextIndex])
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        const prevIndex = (currentIndex - 1 + providerIds.length) % providerIds.length
        setProvider(providerIds[prevIndex])
        break
      case 'Home':
        e.preventDefault()
        setProvider(providerIds[0])
        break
      case 'End':
        e.preventDefault()
        setProvider(providerIds[providerIds.length - 1])
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        handleProviderClick(providerId)
        break
    }
  }

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
      role="radiogroup"
      aria-label="选择 AI 提供商"
    >
      {providers.map((provider, index) => {
        const isSelected = selectedProvider === provider.id
        const isConfigured = isProviderConfigured(provider.id)

        return (
          <motion.button
            key={provider.id}
            data-provider={provider.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleProviderClick(provider.id)}
            onKeyDown={(e) => handleKeyDown(e, provider.id)}
            className={`provider-card relative p-4 rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 ${
              isSelected ? 'selected' : ''
            }`}
            style={{
              backgroundColor: isSelected
                ? 'var(--accent-light)'
                : 'var(--bg-card)',
              borderColor: isSelected
                ? 'var(--accent)'
                : 'var(--border-color)',
              cursor: 'pointer',
              '--tw-ring-color': 'var(--accent)'
            } as React.CSSProperties}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${provider.name}${isConfigured ? '（已配置）' : ''}`}
          >
            <div className="flex flex-col items-center gap-2">
              <div
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: isSelected
                    ? 'var(--accent)'
                    : 'var(--bg-secondary)',
                  color: isSelected
                    ? 'white'
                    : 'var(--text-secondary)'
                }}
              >
                {PROVIDER_ICONS[provider.id]}
              </div>
              <div className="text-center">
                <p
                  className="text-sm font-medium"
                  style={{
                    color: isSelected
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)'
                  }}
                >
                  {provider.name}
                </p>
              </div>

              {isConfigured && (
                <div className="mt-1">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs text-white"
                    style={{ backgroundColor: '#22c55e' }}
                  >
                    ✓
                  </motion.span>
                </div>
              )}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

export default ProviderSelector
