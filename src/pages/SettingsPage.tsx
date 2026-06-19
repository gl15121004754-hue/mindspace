import React from 'react'
import { motion } from 'framer-motion'
import ProviderSelector from '../components/settings/ProviderSelector'
import ApiKeySection from '../components/settings/ApiKeySection'
import ModelSelector from '../components/settings/ModelSelector'
import { useAIConfigStore } from '../store/aiConfigStore'

const SettingsPage: React.FC = () => {
  const selectedProvider = useAIConfigStore((state) => state.selectedProvider)
  const effectiveModel = useAIConfigStore((state) => state.getCurrentModel())
  const isProviderConfigured = useAIConfigStore((state) => state.isProviderConfigured)
  
  const formatProviderName = (provider: string) => {
    const names: Record<string, string> = {
      'openai': 'OpenAI',
      'zhipu': '智谱 AI',
      'deepseek': 'DeepSeek',
      'alibaba': '阿里云',
      'minimax': 'MiniMax',
      'grok': 'Grok'
    }
    return names[provider] || provider
  }

  return (
    <div
      className="min-h-screen p-6 md:p-8"
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* 当前配置状态 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 p-4 rounded-xl border"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)'
          }}
        >
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div>
              <h3 
                className="text-sm font-medium mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                当前配置
              </h3>
              <div className="flex flex-wrap gap-3">
                {/* 提供商标签 */}
                <div 
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: selectedProvider ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: 'white'
                  }}
                >
                  {selectedProvider ? formatProviderName(selectedProvider) : '未选择提供商'}
                </div>
                
                {/* 模型标签 */}
                {effectiveModel && selectedProvider && (
                  <div
                    className="px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    模型: {effectiveModel}
                  </div>
                )}
              </div>
            </div>

            {/* 配置状态 */}
            <div className="flex items-center gap-2">
              <div 
                className={`w-2 h-2 rounded-full ${
                  selectedProvider && isProviderConfigured(selectedProvider) 
                    ? 'bg-green-500' 
                    : 'bg-yellow-500'
                }`}
              />
              <span 
                className="text-sm"
                style={{ 
                  color: selectedProvider && isProviderConfigured(selectedProvider) 
                    ? 'var(--text-success)' 
                    : 'var(--text-warning)'
                }}
              >
                {selectedProvider && isProviderConfigured(selectedProvider)
                  ? '已配置 API 密钥'
                  : selectedProvider
                    ? '请配置 API 密钥'
                    : '请选择提供商'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            AI 设置
          </h1>
          <p
            className="text-sm md:text-base"
            style={{ color: 'var(--text-secondary)' }}
          >
            配置您的 AI 提供商和模型偏好
          </p>
        </motion.div>

        {/* Provider Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-8"
        >
          <div className="mb-4">
            <h2
              className="text-xl font-semibold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              选择提供商
            </h2>
            <p
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              选择您偏好的 AI 服务提供商
            </p>
          </div>
          <ProviderSelector />
        </motion.div>

        {/* API Key Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mb-8"
        >
          <ApiKeySection />
        </motion.div>

        {/* Model Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="mb-4">
            <h2
              className="text-xl font-semibold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              选择模型
            </h2>
            <p
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              选择适合您需求的模型
            </p>
          </div>
          <ModelSelector />
        </motion.div>
      </div>
    </div>
  )
}

export default SettingsPage
