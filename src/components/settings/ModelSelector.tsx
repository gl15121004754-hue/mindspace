import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAIConfigStore } from '../../store/aiConfigStore'
import { MODEL_REGISTRY } from '../../config/aiCatalog'

const ModelSelector: React.FC = () => {
  const selectedProvider = useAIConfigStore((state) => state.selectedProvider)
  const setModel = useAIConfigStore((state) => state.setModel)
  const prevModelRef = useRef<string | null>(null)

  const models = MODEL_REGISTRY.getByProvider(selectedProvider)
  // Effective model for this provider = user choice, else catalog default.
  const effectiveModelId = useAIConfigStore((state) =>
    state.defaultModels[selectedProvider] ?? models[0]?.id
  )

  const handleModelClick = (modelId: string) => {
    setModel(selectedProvider, modelId)
  }

  useEffect(() => {
    if (effectiveModelId && effectiveModelId !== prevModelRef.current) {
      const button = document.querySelector(`[data-model="${effectiveModelId}"]`) as HTMLButtonElement
      button?.focus()
      prevModelRef.current = effectiveModelId
    }
  }, [effectiveModelId])

  const handleKeyDown = (e: React.KeyboardEvent, modelId: string) => {
    const modelIds = models.map(m => m.id)
    const currentIndex = modelIds.indexOf(modelId)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        const nextIndex = (currentIndex + 1) % modelIds.length
        setModel(selectedProvider, modelIds[nextIndex])
        break
      case 'ArrowUp':
        e.preventDefault()
        const prevIndex = (currentIndex - 1 + modelIds.length) % modelIds.length
        setModel(selectedProvider, modelIds[prevIndex])
        break
      case 'Home':
        e.preventDefault()
        setModel(selectedProvider, modelIds[0])
        break
      case 'End':
        e.preventDefault()
        setModel(selectedProvider, modelIds[modelIds.length - 1])
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        handleModelClick(modelId)
        break
    }
  }

  const formatContextLength = (length: number) => {
    if (length >= 1000000) {
      return `${(length / 1000000).toFixed(1)}M`
    }
    if (length >= 1000) {
      return `${(length / 1000).toFixed(0)}K`
    }
    return length.toString()
  }

  if (models.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <p
          className="text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          该提供商暂无可用模型
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-3"
      style={{ backgroundColor: 'var(--bg-card)' }}
      role="radiogroup"
      aria-label="选择 AI 模型"
    >
      {models.map((model, index) => {
        const isSelected = effectiveModelId === model.id

        return (
          <motion.button
            key={model.id}
            data-model={model.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => handleModelClick(model.id)}
            onKeyDown={(e) => handleKeyDown(e, model.id)}
            className={`model-option w-full text-left p-4 rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 ${
              isSelected ? 'selected' : ''
            }`}
            style={{
              backgroundColor: isSelected
                ? 'var(--accent-light)'
                : 'var(--bg-secondary)',
              borderColor: isSelected
                ? 'var(--accent)'
                : 'var(--border-color)',
              cursor: 'pointer',
              '--tw-ring-color': 'var(--accent)'
            } as React.CSSProperties}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${model.name} - ${model.id}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p
                    className="font-semibold"
                    style={{
                      color: isSelected
                        ? 'var(--text-primary)'
                        : 'var(--text-secondary)'
                    }}
                  >
                    {model.name}
                  </p>
                  {model.supportsStreaming && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        color: '#22c55e'
                      }}
                    >
                      流式
                    </span>
                  )}
                </div>
                <p
                  className="text-xs font-mono"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {model.id}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="text-right">
                  <p
                    className="text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    上下文
                  </p>
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatContextLength(model.contextLength)}
                  </p>
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

export default ModelSelector
