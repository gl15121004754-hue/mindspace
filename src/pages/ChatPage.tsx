import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { sendChatMessage } from '../services/enhancedChatService'
import { useChatStore } from '../store/chatStore'
import { ChatHistory } from '../components/ChatHistory'
import { useThemeStore } from '../store/themeStore'
import type { Conversation } from '../types'

const ChatPage: React.FC = () => {
  const [inputValue, setInputValue] = useState('')
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const { theme, toggleTheme } = useThemeStore()
  const location = useLocation()
  
  // SOS 上下文类型
  interface SOSContext {
    fromSOS?: boolean
    emotionType?: string
    intensity?: string
    bodyFeelings?: string[]
    customInput?: string
    empathyMessage?: string
    seedMessage?: string  // from DailyRecordPage "想再聊聊" (Issue #7)
  }

  const sosContext = location.state as SOSContext

  const currentConversation = useChatStore((state) => state.getCurrentConversation())
  const isTyping = useChatStore((state) => state.isTyping)

  const createConversation = useChatStore((state) => state.createConversation)
  const addMessage = useChatStore((state) => state.addMessage)
  const updateMessage = useChatStore((state) => state.updateMessage)
  const setTyping = useChatStore((state) => state.setTyping)
  const conversations = useChatStore((state) => state.conversations)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const hasInitializedSOS = useRef(false)

  useEffect(() => {
    // 如果来自 SOS 且未初始化过，强制创建新对话
    if (sosContext?.fromSOS && sosContext?.emotionType && !hasInitializedSOS.current) {
      hasInitializedSOS.current = true
      
      // 构建情绪上下文
      let emotionContext = ''
      const bodyFeelings = sosContext.bodyFeelings?.join('、') || ''
      const intensityText = {
        mild: '轻微',
        moderate: '中等',
        severe: '严重',
        extreme: '极度'
      }[sosContext.intensity || 'moderate'] || ''
      
      emotionContext = `${intensityText}${sosContext.emotionType}情绪`
      if (bodyFeelings) {
        emotionContext += `，伴随${bodyFeelings}`
      }
      if (sosContext.customInput) {
        emotionContext += `，情况：${sosContext.customInput}`
      }
      
      // 创建新对话
      createConversation(emotionContext)
      console.log('[ChatPage] SOS 跳转，创建新对话，携带情绪上下文:', emotionContext)
      
      // 添加 AI 欢迎消息
      if (sosContext.empathyMessage) {
        const welcomeMessage = {
          role: 'assistant' as const,
          content: sosContext.empathyMessage
        }
        addMessage(welcomeMessage)
        console.log('[ChatPage] 添加 SOS 欢迎消息:', sosContext.empathyMessage)
      }
    } else if (!currentConversation && !sosContext?.fromSOS) {
      // 普通情况：没有对话且不是 SOS 时才创建
      createConversation()
    }
  }, [sosContext, createConversation, addMessage, currentConversation, sosContext])

  // Seed the input with a message carried from DailyRecordPage (Issue #7).
  // Pre-fill only — let the user review and send, never auto-send.
  const hasSeededMessage = useRef(false)
  useEffect(() => {
    if (sosContext?.seedMessage && !hasSeededMessage.current) {
      hasSeededMessage.current = true
      setInputValue(sosContext.seedMessage)
    }
  }, [sosContext])

  // 调试：打印对话历史状态
  useEffect(() => {
    console.log('[ChatPage] 对话历史状态:', {
      conversationsCount: conversations.length,
      currentConversationId: currentConversation?.id,
      currentMessagesCount: currentConversation?.messages.length || 0
    })
  }, [conversations, currentConversation])

  const messages = currentConversation?.messages || []
  const hasMessages = messages.length > 0

  useEffect(() => {
    if (!hasMessages && inputRef.current) {
      inputRef.current.focus()
      const length = inputRef.current.value.length
      inputRef.current.setSelectionRange(length, length)
    }
  }, [hasMessages])

  useEffect(() => {
    if (hasMessages && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages, hasMessages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return

    const userMessage = {
      role: 'user' as const,
      content: inputValue.trim()
    }

    addMessage(userMessage)
    const userContent = inputValue.trim()
    setInputValue('')
    setTyping(true)

    try {
      const historyMessages = currentConversation?.messages || []

      const aiMessage = {
        role: 'assistant' as const,
        content: ''
      }

      const aiMessageId = addMessage(aiMessage)

      let streamedContent = ''
      const response = await sendChatMessage(
        historyMessages,
        userContent,
        (chunk) => {
          streamedContent += chunk
          updateMessage(aiMessageId, streamedContent)
        }
      )

      if (response.content && response.content !== streamedContent) {
        updateMessage(aiMessageId, response.content)
      }
      setTyping(false)

      if (response.needsSOS) {
        setTimeout(() => {
          const sosMessage = {
            role: 'assistant' as const,
            content: '💡 提示：如果你现在感到很难受，可以点击右下角的红色SOS按钮，我们有专门的60秒急救练习。'
          }
          addMessage(sosMessage)
        }, 2000)
      }

      if (response.crisis && !response.needsSOS) {
        setTimeout(() => {
          const crisisMessage = {
            role: 'assistant' as const,
            content: '你想聊聊发生了什么吗？或者我们直接开始做一些缓解练习？'
          }
          addMessage(crisisMessage)
        }, 3000)
      }

    } catch (error: any) {
      console.error('发送消息失败:', error)
      
      const errorMessage = {
        role: 'assistant' as const,
        content: '抱歉，我现在有点忙不过来。🌙\n\n不过我还是在这里陪着你，你可以继续和我说话。'
      }
      addMessage(errorMessage)
      setTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSelectConversation = (conversation: Conversation) => {
    useChatStore.setState({ currentConversationId: conversation.id })
    setIsHistoryOpen(false)
  }

  const handleEndConversation = () => {
    createConversation()
    setInputValue('')
  }

  return (
    <div className="flex h-full relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 点击遮罩层 - 点击关闭历史记录 */}
      {isHistoryOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
          onClick={() => setIsHistoryOpen(false)}
        />
      )}
      
      {/* Chat History Sidebar */}
      <ChatHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectConversation={handleSelectConversation}
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 px-6 py-6 z-10" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="relative">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 hover:opacity-80 rounded-full transition-all relative"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0" />
              </svg>
              {/* 历史记录数量徽章 */}
              {conversations.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center"
                  style={{ 
                    backgroundColor: 'var(--accent)', 
                    color: 'white'
                  }}>
                  {conversations.length > 99 ? '99+' : conversations.length}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 hover:opacity-80 rounded-full transition-all"
            style={{ color: 'var(--text-secondary)' }}
          >
            {theme === 'light' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area - Slides Right When Sidebar Opens */}
      <motion.div
        initial={false}
        animate={{
          marginLeft: isHistoryOpen ? '20rem' : '0rem'
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="flex-1 flex flex-col h-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        {/* Messages Area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6">
          <div className="max-w-2xl mx-auto pt-20 pb-4">
            {!hasMessages ? (
              // Empty State - Centered Input at Top
              <div className="min-h-[60vh] flex items-start justify-center pt-8">
                <div className="w-full">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="这一刻，你在想什么..."
                    className="w-full px-0 py-4 resize-none focus:outline-none transition-all text-lg placeholder:text-neutral-300 bg-transparent text-left"
                    rows={1}
                    style={{
                      minHeight: '56px',
                      maxHeight: '160px',
                      color: 'var(--text-primary)',
                      caretColor: 'var(--text-primary)'
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = Math.min(Math.max(target.scrollHeight, 56), 160) + 'px'
                    }}
                  />
                   <AnimatePresence>
                     {inputValue.trim() && (
                       <motion.div
                         initial={{ opacity: 0, y: -10 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0, y: -10 }}
                         className="flex justify-start mt-4"
                       >
                         <motion.button
                           onClick={handleSendMessage}
                           disabled={isTyping}
                           className="px-6 py-2 font-medium transition-all rounded-2xl"
                           style={{
                             backgroundColor: 'var(--accent)',
                             color: 'white'
                           }}
                           whileHover={{ scale: 1.02, opacity: 0.9 }}
                           whileTap={{ scale: 0.98 }}
                         >
                           {isTyping ? (
                             <div className="flex items-center gap-1">
                               <div className="w-3 h-3 rounded-full animate-bounce" style={{ backgroundColor: 'white', opacity: 0.75 }}></div>
                               <div className="w-3 h-3 rounded-full animate-bounce" style={{ backgroundColor: 'white', opacity: 0.75, animationDelay: '0.1s' }}></div>
                               <div className="w-3 h-3 rounded-full animate-bounce" style={{ backgroundColor: 'white', opacity: 0.75, animationDelay: '0.2s' }}></div>
                             </div>
                           ) : (
                             '发送'
                           )}
                         </motion.button>
                       </motion.div>
                     )}
                   </AnimatePresence>
                </div>
              </div>
            ) : (
              // Messages List
              <div className="space-y-3">
                {messages.map((message, index) => {
                  // 最后一条消息且是 AI 正在流式输出
                  const isStreaming = index === messages.length - 1 && 
                                     message.role === 'assistant' && 
                                     isTyping && 
                                     message.content.length > 0
                  
                  return (
                    <div
                      key={message.id}
                      className="flex justify-start"
                      style={{ 
                        // 流式消息禁用所有动画
                        animation: isStreaming ? 'none' : undefined,
                        opacity: 1
                      }}
                    >
                      {message.role === 'assistant' ? (
                        <div className="flex items-start gap-3 max-w-[80%]">
                          <div className="w-1 h-full rounded-full" style={{ backgroundColor: 'var(--accent)' }}></div>
                          <div style={{ color: 'var(--accent)' }}>
                            {/* 流式消息直接显示文本，无动画 */}
                            <div className="whitespace-pre-wrap">
                              {message.content}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-primary)' }}>
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          </motion.div>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area at Bottom (Only When Has Messages) */}
        {hasMessages && (
          <div className="px-6 pb-4">
            <div className="max-w-2xl mx-auto">
              <div className="flex flex-col items-start">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="写在这..."
                  className="w-full px-0 py-3 resize-none focus:outline-none transition-all text-lg placeholder:text-neutral-300 bg-transparent text-left"
                  rows={1}
                  style={{
                    minHeight: '48px',
                    maxHeight: '120px',
                    color: 'var(--text-primary)',
                    caretColor: 'var(--text-primary)'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = Math.min(Math.max(target.scrollHeight, 48), 120) + 'px'
                  }}
                />
                <div className="flex items-center gap-3 mt-3">
                  {/* 发送按钮 - 突出显示 */}
                  <motion.button
                    onClick={handleSendMessage}
                    disabled={isTyping || !inputValue.trim()}
                    className="px-6 py-2 font-medium transition-all rounded-2xl"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'white',
                      opacity: inputValue.trim() ? 1 : 0.5
                    }}
                    whileHover={inputValue.trim() ? { scale: 1.02, opacity: 0.9 } : {}}
                    whileTap={inputValue.trim() ? { scale: 0.98 } : {}}
                  >
                    {isTyping ? (
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full animate-bounce" style={{ backgroundColor: 'white', opacity: 0.75 }}></div>
                        <div className="w-3 h-3 rounded-full animate-bounce" style={{ backgroundColor: 'white', opacity: 0.75, animationDelay: '0.1s' }}></div>
                        <div className="w-3 h-3 rounded-full animate-bounce" style={{ backgroundColor: 'white', opacity: 0.75, animationDelay: '0.2s' }}></div>
                      </div>
                    ) : (
                      '发送'
                    )}
                  </motion.button>
                  
                  {/* 结束按钮 - 弱化显示 */}
                  <motion.button
                    onClick={handleEndConversation}
                    className="px-4 py-2 font-medium transition-all rounded-2xl text-sm"
                    style={{
                      color: 'var(--text-tertiary)',
                      backgroundColor: 'transparent'
                    }}
                    whileHover={{ scale: 1.02, color: 'var(--text-secondary)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    结束对话
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default ChatPage
