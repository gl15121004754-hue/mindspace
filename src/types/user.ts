// 用户信息类型
export interface UserProfile {
  id: string
  nickname: string
  email?: string
  avatar?: string
  createdAt: number
  updatedAt: number
  lastLoginAt: number
}

// 注册表单数据
export interface RegisterForm {
  nickname: string
  email?: string
  password?: string  // 本地存储用简单密码
}

// 用户统计信息
export interface UserStats {
  totalEmotions: number
  totalSOS: number
  avgEffectiveness: number
  memberSince: number
  streak: number  // 连续使用天数
}
