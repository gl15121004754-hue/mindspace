import type { Message } from '../types'
import { useAIConfigStore } from '../store/aiConfigStore'

// 消息类型
interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// AI响应类型
interface AIResponse {
  content: string
  needsSOS?: boolean
  crisis?: boolean
  emotionTags?: string[]
}

/** Endpoint + model resolved by the store from the single catalog. */
interface EndpointConfig {
  apiUrl: string
  model: string
}

// MindSpace核心系统提示词
const MINDSPACE_SYSTEM_PROMPT = `你是 MindSpace，一个温暖真诚的AI伙伴，专门陪伴和支持高压都市女性。

你最重要的特质：
- 真诚自然，像知心朋友一样聊天
- 善于倾听，先理解再回应
- 温暖共情，但不矫情做作
- 偶尔使用emoji，但适度自然

对话原则：
1. 用日常语言，像朋友聊天一样自然
2. 回复要简短，一般1-2句话，最多3句
3. 避免说教和"你应该"这类表达
4. 多用"我理解""我感受到""听起来"等共情表达
5. 适当提问，但不要像心理咨询师那样生硬
6. 可以有个性，偶尔幽默或自嘲

回复风格：
- 温暖但不肉麻
- 专业但不疏离  
- 支持但不依赖
- 真诚但不刻意

记住：
1. 你不是心理医生，是一个善解人意的朋友
2. 不要给具体建议，除非对方明确求助
3. 关注对方的感受，而不是解决问题
4. 对话要像微信聊天，简洁自然
5. 每次回复不超过60字，保持对话流动性`

// 危机关键词检测
const CRISIS_KEYWORDS = {
  panic: ['喘不上气', '手在抖', '心跳好快', '要疯了', '崩溃', '惊恐'],
  self_harm: ['不想活了', '想结束', '想死', '自杀', '自残']
}

// 情绪关键词映射
const EMOTION_KEYWORDS = {
  anxiety: ['焦虑', '紧张', '担心', '害怕', '不安', '恐慌'],
  anger: ['愤怒', '生气', '火大', '气死了', '烦躁'],
  sadness: ['难过', '伤心', '想哭', '委屈', '失落'],
  exhaustion: ['累', '疲惫', '撑不住', '坚持不下去', '耗尽'],
  stress: ['压力', '压抑', '喘不过气', '承受不住']
}

/**
 * 检测危机关键词
 */
function detectCrisis(text: string): { crisis: boolean; type?: 'panic' | 'self_harm' } {
  const lowerText = text.toLowerCase()
  
  for (const keyword of CRISIS_KEYWORDS.self_harm) {
    if (lowerText.includes(keyword)) {
      return { crisis: true, type: 'self_harm' }
    }
  }
  
  for (const keyword of CRISIS_KEYWORDS.panic) {
    if (lowerText.includes(keyword)) {
      return { crisis: true, type: 'panic' }
    }
  }
  
  return { crisis: false }
}

/**
 * 提取情绪标签
 */
function extractEmotionTags(text: string): string[] {
  const tags: string[] = []
  const lowerText = text.toLowerCase()
  
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      tags.push(emotion)
    }
  }
  
  return tags
}

/**
 * 调用AI API
 */
async function callAIAPI(
  messages: ChatMessage[],
  endpoint: EndpointConfig,
  apiKey: string,
  onStream?: (chunk: string) => void
): Promise<string> {
  console.log('🔍 准备调用 AI API')
  console.log('📤 API URL:', endpoint.apiUrl)
  console.log('📤 模型:', endpoint.model)
  console.log('🔑 API Key前缀:', apiKey.substring(0, 10) + '...')
  console.log('💬 消息数量:', messages.length)
  console.log('🌊 流式响应模式:', !!onStream)

  if (onStream) {
    return await callOpenAIStream(messages, onStream, apiKey, endpoint)
  } else {
    return await callOpenAINonStream(messages, apiKey, endpoint)
  }
}

/**
 * OpenAI兼容格式流式调用
 */
async function callOpenAIStream(
  messages: ChatMessage[],
  onStream: (chunk: string) => void,
  apiKey: string,
  config: { apiUrl: string; model: string }
): Promise<string> {
  console.log('🌊 使用 OpenAI 兼容流式响应模式')

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: 0.8,
        max_tokens: 150,
        top_p: 0.9,
        stream: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API错误响应:', errorText)
      throw new Error(`API错误: ${response.status} ${errorText}`)
    }

    if (!response.body || !response.body.getReader) {
      console.warn('⚠️ 不支持流式响应，回退到非流式')
      return await callOpenAINonStream(messages, apiKey, config)
    }

    const decoder = new TextDecoder()
    const reader = response.body.getReader()
    
    let fullContent = ''
    let chunkCount = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          console.log('🎯 流式响应完成，共', chunkCount, '个chunk')
          break
        }
        
        chunkCount++
        const text = decoder.decode(value, { stream: true })
        
        const lines = text.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            if (data === '[DONE]') {
              console.log('📨 收到 [DONE] 信号')
              break
            }
            
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content
              if (content) {
                fullContent += content
                onStream(content)
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
    
    console.log('✅ 流式响应完成，总长度:', fullContent.length)
    return fullContent

  } catch (error) {
    console.error('❌ 流式调用失败:', error)
    console.log('📝 回退到非流式响应...')
    return await callOpenAINonStream(messages, apiKey, config)
  }
}

/**
 * OpenAI兼容格式非流式调用
 */
async function callOpenAINonStream(
  messages: ChatMessage[],
  apiKey: string,
  config: { apiUrl: string; model: string }
): Promise<string> {
  console.log('📝 使用非流式响应模式')

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: 0.8,
      max_tokens: 150,
      top_p: 0.9,
      stream: false
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ API错误响应:', errorText)
    throw new Error(`API错误: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  
  if (data.error) {
    console.error('❌ API返回错误:', data.error.message)
    throw new Error(`API错误: ${data.error.message}`)
  }

  const content = data.choices?.[0]?.message?.content || ''
  console.log('🎯 获得AI回复内容:', content.substring(0, 100) + '...')
  return content
}

/**
 * 发送聊天消息
 */
export async function sendChatMessage(
  historyMessages: Message[],
  userMessage: string,
  onStream?: (chunk: string) => void
): Promise<AIResponse> {
  console.log('🚀 开始处理用户消息:', userMessage.substring(0, 50) + '...')
  
  // 危机检测
  const crisisDetection = detectCrisis(userMessage)
  console.log('🚨 危机检测结果:', crisisDetection)
  
  // 情绪标签提取
  const emotionTags = extractEmotionTags(userMessage)
  console.log('🏷️ 情绪标签:', emotionTags)

  // Resolve provider/url/model/key from the store (single source of truth).
  const { provider, apiUrl, model, apiKey } = useAIConfigStore.getState().resolveChatConfig()
  console.log('📤 使用提供商:', provider)

  if (!apiUrl || !model) {
    console.log('[AI Config] 未知提供商，使用备用回复')
    return {
      content: generateFallbackResponse(userMessage),
      needsSOS: false,
      crisis: false,
      emotionTags
    }
  }

  if (!apiKey) {
    console.log('[AI Config] 未配置 API Key，使用备用回复')
    const fallbackContent = generateFallbackResponse(userMessage) +
      '\n\n💡 小提示：你可以去「AI 设置」页面配置 API Key，让我变得更聪明哦~'
    return {
      content: fallbackContent,
      needsSOS: false,
      crisis: false,
      emotionTags
    }
  }

  // 构建完整的对话历史
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: MINDSPACE_SYSTEM_PROMPT },
    ...historyMessages.slice(-10).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ]

  try {
    // 如果检测到危机，返回预设回复
    if (crisisDetection.crisis) {
      console.log('⚠️ 检测到危机情况，使用预设回复')
      return handleCrisisResponse(crisisDetection.type)
    }

    // 调用AI API
    const content = await callAIAPI(fullMessages, { apiUrl, model }, apiKey, onStream)
    
    return {
      content,
      needsSOS: crisisDetection.crisis && crisisDetection.type === 'panic',
      crisis: crisisDetection.crisis,
      emotionTags
    }

  } catch (error: any) {
    console.error('AI对话失败:', error)
    
    // 生成友好错误回复
    let fallbackContent = generateFallbackResponse(userMessage)
    
    // 如果没有配置 AI Key，添加提示
    if (!apiKey) {
      fallbackContent += '\n\n💡 小提示：你可以去「AI 设置」页面配置 API Key，让我变得更聪明哦~'
    }
    
    return {
      content: fallbackContent,
      needsSOS: false,
      crisis: false,
      emotionTags
    }
  }
}

/**
 * 处理危机情况回复
 */
function handleCrisisResponse(crisisType?: 'panic' | 'self_harm'): AIResponse {
  if (crisisType === 'self_harm') {
    const options = [
      '我听到了你的痛苦，这一刻一定很难熬🌙\n\n但请记住，你不是一个人。如果需要专业帮助，可以拨打心理援助热线：400-161-9995',
      '我能感受到你现在的痛苦，请给自己一个机会💙\n\n专业帮助可以拨打心理援助热线：400-161-9995，有人愿意支持你',
      '这种时候真的很难熬，我理解你的感受🫂\n\n但请相信，还有人在乎你。心理援助热线：400-161-9995'
    ]
    return {
      content: options[Math.floor(Math.random() * options.length)],
      crisis: true,
      needsSOS: false
    }
  }
  
  if (crisisType === 'panic') {
    const options = [
      '深呼吸，我就在这里陪着你🫂\n\n先花60秒让心跳慢下来，好吗？点击右下角的SOS按钮',
      '我在这里，感受到你的惊恐了💙\n\n我们先做60秒急救练习，点击右下角SOS按钮，我会陪你慢慢来',
      '别怕，我陪着你✨ 感觉很可怕对吧？我们先从60秒呼吸练习开始，点击SOS按钮'
    ]
    return {
      content: options[Math.floor(Math.random() * options.length)],
      crisis: true,
      needsSOS: true
    }
  }
  
  const defaultOptions = [
    '我在这里陪着你🫂 这种感觉真的很不好受，想聊聊吗？',
    '感受到了你的痛苦，我在听💭 你现在想说说看吗？',
    '嗯，这种时刻真的很难熬，但我在这里✨'
  ]
  return {
    content: defaultOptions[Math.floor(Math.random() * defaultOptions.length)],
    crisis: true,
    needsSOS: false
  }
}

/**
 * 生成备用回复（当API失败时）
 */
function generateFallbackResponse(userMessage: string): string {
  const input = userMessage.toLowerCase()
  
  const responses = [
    {
      keywords: ['被骂', '批评', '老板', '领导'],
      options: [
        '抱抱，被批评的感觉真的很不好受😢 这种情况确实很委屈',
        '哎，被当面批评谁都会难过的，很正常你会有这种反应',
        '我能理解你的感受，换做是我也会觉得委屈',
        '这种场合被批评，真的很考验心理素质呢'
      ]
    },
    {
      keywords: ['焦虑', '紧张', '担心', '害怕'],
      options: [
        '感受到了，焦虑真的很难受💭 这种感觉是从什么时候开始的？',
        '嗯，焦虑就像心里的警报器一直在响，很累人吧',
        '我理解，那种紧张感确实很消耗精力',
        '听起来你现在压力不小呢，想聊聊具体是什么让你焦虑吗？'
      ]
    },
    {
      keywords: ['累', '疲惫', '撑不住', '坚持不下去'],
      options: [
        '你已经很努力了，真的🌱 累了就歇会儿吧',
        '嗯，感觉身体在提醒你需要休息了呢',
        '抱抱，这种疲惫感我懂的，不要太勉强自己',
        '听起来你真的需要好好休息一下了'
      ]
    },
    {
      keywords: ['委屈', '难过', '想哭', '伤心'],
      options: [
        '委屈的感觉真的很难熬😢 想哭就哭出来吧',
        '我懂，这种时候确实很不好受，你不需要假装坚强',
        '抱抱你🫂 这种时刻有人理解你的感受吗？',
        '听起来真的很难过，发生什么事了？'
      ]
    },
    {
      keywords: ['愤怒', '生气', '火大', '气死了'],
      options: [
        '嗯，愤怒确实很难控制，到底是什么让你这么生气？',
        '我理解，有些事确实很让人火大呢',
        '这种愤怒是正常的，想说说看发生了什么吗？',
        '感受到你的怒气了，这种情况下谁都会生气的'
      ]
    },
    {
      keywords: ['压力', '压抑', '喘不过气'],
      options: [
        '嗯，感觉被压得很重对吧？我们能慢慢聊聊',
        '我理解，那种压力确实很让人窒息',
        '听起来你现在承受了很多，想分享一下吗？',
        '抱抱，这种压抑感真的很难熬🫂'
      ]
    }
  ]

  for (const response of responses) {
    if (response.keywords.some(keyword => input.includes(keyword))) {
      return response.options[Math.floor(Math.random() * response.options.length)]
    }
  }

  const defaultResponses = [
    '嗯嗯，我在听✨ 能多跟我说说吗？',
    '我理解你的感受，继续说，我在听💭',
    '听起来确实不容易呢，想详细聊聊吗？',
    '感受到了，这种时候有个人聊聊会好点吗？',
    '我懂这种感觉，你想聊聊具体的情况吗？',
    '嗯嗯，继续说，我在这里陪着你🌙'
  ]
  
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)]
}

/**
 * 分析对话情绪（用于生成情绪报告）
 */
export async function analyzeConversationEmotions(messages: Message[]): Promise<{
  dominantEmotions: string[]
  triggers: string[]
  summary: string
}> {
  const emotionCounts: Record<string, number> = {}
  
  for (const message of messages) {
    if (message.role === 'user') {
      const tags = extractEmotionTags(message.content)
      for (const tag of tags) {
        emotionCounts[tag] = (emotionCounts[tag] || 0) + 1
      }
    }
  }
  
  const dominantEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([emotion]) => emotion)
  
  return {
    dominantEmotions,
    triggers: [],
    summary: '这段对话主要围绕' + dominantEmotions.join('、') + '等情绪展开。'
  }
}

export type { ChatMessage, AIResponse }
