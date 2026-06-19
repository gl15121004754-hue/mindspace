// 记录来源：同一条 EmotionRecord 可能来自每日记录、SOS 或（未来）对话提取。
// 见 ADR-0001 与 lib/dailyRecord.ts 的 resolveSource 兜底逻辑。
export type EmotionRecordSource = 'daily' | 'sos' | 'chat';

// 情绪记录类型
export interface EmotionRecord {
  id: string;
  emotion: string;           // 情绪类型：焦虑、悲伤、愤怒、平静、疲惫等
  intensity: number;         // 强度：1-10（每日记录统一为"感受有多强烈"，不分正负）
  trigger?: string;          // 触发因素
  context?: string;          // 详细描述
  copingMethod?: string;     // 应对方法（legacy 也兼职来源标记，新记录优先用 source）
  effectiveness?: number;    // 效果评价：1-5
  timestamp: number;         // 时间戳
  tags?: string[];           // 自动生成的情绪标签
  source?: EmotionRecordSource;  // 记录来源（旧记录缺省，由 resolveSource 兜底）
  aiReflection?: string;     // 每日记录的 AI 反馈文字（由 #7 填充；不进对话历史）
}

// SOS 使用记录
export interface SOSRecord {
  id: string;
  triggerEmotion: string;    // 触发情绪
  selectedAidType: string;   // 急救类型
  duration: number;          // 使用时长（秒）
  feedback?: number;         // 效果反馈：1-5
  followUpAction?: string;   // 后续行动
  timestamp: number;
}

// 用户偏好
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: boolean;
  privacyMode: boolean;      // 隐私模式开关
  defaultView: 'home' | 'sos' | 'chat' | 'insight';
  aiPersonality: 'empathetic' | 'rational' | 'concise';
  autoSave: boolean;
}

// 存储元数据
export interface StorageMetadata {
  version: string;
  createdAt: number;
  lastUpdated: number;
  emotionCount: number;
  firstUseDate: number;
}
