/**
 * Daily Reflection — AI feedback for the daily-record loop (Issue #7).
 *
 * This module owns:
 * 1. The two-layer reflection context (today + 6-day structured history +
 *    30-day aggregated stats) — see ADR-0002/0003 and CONTEXT.md "AI 反馈".
 * 2. The one-shot system prompt (distinct from the multi-turn chat prompt in
 *    enhancedChatService — reflection is a single, longer, context-aware reply).
 * 3. Unified AI key resolution (user key > platform key > none) — ADR-0004.
 * 4. The AI call + graceful fallback.
 *
 * Privacy/token contract: history records contribute emotion + intensity only;
 * their free text is NEVER sent to the model. Only today's record text travels.
 */

import type { EmotionRecord } from '../types/storage';
import type { InsightStats, TrendDay } from './insights';
import { DAILY_EMOTIONS } from './dailyRecord';
import { detectCrisis, buildCrisisIntervention } from './crisisDetection';
import { canUsePlatformQuota, consumePlatformQuota } from './dailyQuota';
import { useAIConfigStore } from '../store/aiConfigStore';
import { getApiKey } from './aiKeyManager';
import { PROVIDER_CATALOG, resolveChatEndpoint } from '../config/aiCatalog';
import type { AIProviderId } from '../types/aiProvider';

// ============ Types ============

export interface CurrentRecordContext {
  emotion: string;
  emotionLabel: string;
  intensity: number;
  text?: string;
}

export interface RecentRecordContext {
  emotion: string;
  emotionLabel: string;
  intensity: number;
  // NOTE: intentionally no `text` — history free text is never sent to the model.
}

export interface ReflectionContext {
  current: CurrentRecordContext;
  recent: RecentRecordContext[]; // up to 6 prior days, structured only
  monthStats: InsightStats | null;
  trend: TrendDay[];
  trendDirection: 'rising' | 'falling' | 'flat';
}

// ============ System prompt ============

/**
 * One-shot reflection prompt. Unlike the chat persona (≤60 chars, WeChat-style),
 * this asks for a single, warmer, context-aware reply that acknowledges both the
 * user's current entry and their longer-term patterns. Wording is intentionally
 * stable — tests assert only structure, not this text.
 */
export const REFLECTION_SYSTEM_PROMPT = `你是 MindSpace，一个温暖、真诚、专注陪伴的 AI 伙伴。

用户刚刚记下今天的一条心情。请基于 ta 今天记录的情绪、强度和文字，结合 ta 过去一段时间的情绪模式，给出一段真诚、贴合的回应。

回应原则：
1. 先共情当下的具体感受，让 ta 感到被看见、被理解
2. 如果有历史情绪模式可参考，温和地点出（例如"注意到你最近焦虑偏多"），但不要评判或诊断
3. 如果用户写了文字，回应要贴合文字内容；如果没写文字，基于历史给出有温度的回应，不要空洞
4. 不要给出医疗建议、不要说教、不要使用"你应该"的句式
5. 回应是单次的，不提问要求继续对话，像一个被倾听后自然流出的回应
6. 长度适中，约 80-150 字，温暖但不冗长
7. 用中文，像对一个信任的朋友说话`;

// ============ Context building ============

const emotionLabel = (key: string): string =>
  DAILY_EMOTIONS.find((e) => e.key === key)?.label ?? key;

function deriveTrendDirection(trend: TrendDay[]): 'rising' | 'falling' | 'flat' {
  // Compare the average of the last 3 days vs the first 3 days (rolling mean).
  const withData = trend.filter((d) => d.count > 0);
  if (withData.length < 2) return 'flat';
  const first = withData.slice(0, Math.min(3, Math.floor(withData.length / 2)));
  const last = withData.slice(-Math.min(3, Math.floor(withData.length / 2)));
  const avg = (arr: TrendDay[]) =>
    arr.reduce((acc, d) => acc + d.avgIntensity, 0) / arr.length;
  const delta = avg(last) - avg(first);
  if (delta > 0.5) return 'rising';
  if (delta < -0.5) return 'falling';
  return 'flat';
}

/**
 * Build the reflection context from raw inputs. Pure function — does not call
 * insights.ts itself; the caller passes already-computed stats/trend so this
 * stays unit-testable and dependency-free.
 *
 * @param currentRecord  today's record (emotion/intensity/text travel to model)
 * @param recentRecords  up to ~6 prior days' records (emotion+intensity only)
 * @param monthStats     30-day aggregated stats (may be null for new users)
 * @param trend          7-day trend (from recentTrend)
 */
export function buildReflectionContext(
  currentRecord: EmotionRecord,
  recentRecords: EmotionRecord[],
  monthStats: InsightStats | null,
  trend: TrendDay[]
): ReflectionContext {
  return {
    current: {
      emotion: currentRecord.emotion,
      emotionLabel: emotionLabel(currentRecord.emotion),
      intensity: currentRecord.intensity,
      text: currentRecord.context?.trim() || undefined,
    },
    recent: recentRecords
      .filter((r) => r.id !== currentRecord.id)
      .slice(0, 6)
      .map((r) => ({
        emotion: r.emotion,
        emotionLabel: emotionLabel(r.emotion),
        intensity: r.intensity,
      })),
    monthStats,
    trend,
    trendDirection: deriveTrendDirection(trend),
  };
}

// ============ Prompt assembly ============

const TREND_DIRECTION_LABEL: Record<ReflectionContext['trendDirection'], string> = {
  rising: '强度在上升',
  falling: '强度在下降',
  flat: '强度较平稳',
};

/**
 * Format the reflection context into the `user` message for the model.
 * Today's text is included; history texts are not (privacy contract).
 */
export function buildReflectionUserMessage(ctx: ReflectionContext): string {
  const lines: string[] = [];

  // today
  lines.push(`【今天的记录】`);
  lines.push(`情绪：${ctx.current.emotionLabel}`);
  lines.push(`强度：${ctx.current.intensity}/10`);
  if (ctx.current.text) {
    lines.push(`ta 写的话：${ctx.current.text}`);
  } else {
    lines.push(`（今天没有写文字）`);
  }

  // recent 6 days (structured, no text)
  if (ctx.recent.length > 0) {
    lines.push('');
    lines.push(`【过去几天的记录（情绪与强度）】`);
    ctx.recent.forEach((r) => {
      lines.push(`- ${r.emotionLabel}，强度 ${r.intensity}/10`);
    });
  }

  // 30-day stats
  if (ctx.monthStats && ctx.monthStats.totalEmotions > 0) {
    lines.push('');
    lines.push(`【过去一个月的整体情况】`);
    lines.push(`记录总数：${ctx.monthStats.totalEmotions} 条`);
    lines.push(`主导情绪：${emotionLabel(ctx.monthStats.dominantEmotion)}`);
    lines.push(`平均强度：${ctx.monthStats.avgIntensity}/10`);
    lines.push(`趋势：${TREND_DIRECTION_LABEL[ctx.trendDirection]}`);
  }

  lines.push('');
  lines.push('请给出你的回应。');

  return lines.join('\n');
}

// ============ Unified key resolution (ADR-0004) ============

/**
 * The platform fallback provider — mirrors the SOS path (aiService.ts), which
 * always uses Alibaba DashScope + qwen-plus via VITE_DASHSCOPE_API_KEY.
 */
const PLATFORM_PROVIDER: AIProviderId = 'alibaba';

export interface ReflectionAIConfig {
  apiUrl: string;
  model: string;
  apiKey: string;
  provider: AIProviderId;
}

export interface ResolvedReflectionConfig {
  /** Where the key came from — drives quota behavior (#9). */
  source: 'user' | 'platform' | 'none';
  config: ReflectionAIConfig | null;
  /**
   * True when the user supplied their own key → unlimited, not subject to the
   * platform daily quota. False for platform key (quota-bound). Irrelevant for none.
   */
  quotaExempt: boolean;
}

/**
 * Resolve which AI key/provider to use for a reflection, unifying the two
 * previously disjoint paths (chat = user-only, SOS = platform-only).
 *
 * Priority:
 * 1. User-configured key (aiConfigStore.resolveChatConfig) → source 'user', quotaExempt
 * 2. Platform env key (aiKeyManager.getApiKey, alibaba/qwen-plus) → 'platform', quota-bound
 * 3. None → no config (caller shows a placeholder)
 */
export function resolveReflectionConfig(): ResolvedReflectionConfig {
  // 1. Try the user's configured provider/key first.
  const userConfig = useAIConfigStore.getState().resolveChatConfig();
  if (userConfig.apiUrl && userConfig.model && userConfig.apiKey) {
    return {
      source: 'user',
      config: {
        apiUrl: userConfig.apiUrl,
        model: userConfig.model,
        apiKey: userConfig.apiKey,
        provider: userConfig.provider,
      },
      quotaExempt: true,
    };
  }

  // 2. Fall back to the platform key (alibaba/qwen-plus), mirroring SOS.
  const platform = getApiKey(PLATFORM_PROVIDER);
  const entry = PROVIDER_CATALOG[PLATFORM_PROVIDER];
  if (platform.key && entry) {
    return {
      source: 'platform',
      config: {
        apiUrl: resolveChatEndpoint(PLATFORM_PROVIDER),
        model: entry.defaultModel,
        apiKey: platform.key,
        provider: PLATFORM_PROVIDER,
      },
      quotaExempt: false,
    };
  }

  // 3. Nothing available.
  return { source: 'none', config: null, quotaExempt: false };
}

// ============ AI call + fallback ============

/**
 * Local placeholder shown when no AI key is available, or the call fails.
 * Intentionally explicit that it is NOT an AI reply (per PRD: never pretend).
 */
export const FALLBACK_REFLECTION =
  '谢谢你记下这一刻。我暂时还没法用 AI 回应你，但你的感受被认真对待了。想倾诉更多的话，可以去对话里聊聊。';

/**
 * Local placeholder shown when the free platform-key daily quota is exhausted.
 * Explicitly NOT an AI reply, and nudges the user toward chat (where their own
 * conversation can continue) or configuring their own key for unlimited reflections.
 */
export const QUOTA_EXHAUSTED_REFLECTION =
  '今天的免费 AI 回应额度用完啦。你的感受依然被认真对待——想继续倾诉的话，可以去对话里聊聊，或在设置里连接你自己的 AI。';

export interface ReflectionResult {
  reflection: string;
  /** True if the model output (or placeholder) was a fallback, not a real reply. */
  fallback: boolean;
  /** Placeholder for #8 crisis detection; always false in the happy path. */
  crisis: boolean;
}

/**
 * Generate a single AI reflection for a daily record. Never throws — failures
 * degrade to FALLBACK_REFLECTION, matching aiService.ts conventions.
 */
export async function generateReflection(
  ctx: ReflectionContext,
  resolved: ResolvedReflectionConfig
): Promise<ReflectionResult> {
  // Crisis check FIRST — before config/keys. Even with no AI key configured, a
  // crisis signal must trigger immediate intervention (Issue #8). This also
  // exempts crisis from the quota (#9): crisis never consumes AI budget.
  const crisis = detectCrisis(ctx.current.text ?? '');
  if (crisis.crisis && crisis.type) {
    return {
      reflection: buildCrisisIntervention(crisis.type),
      fallback: false,
      crisis: true,
    };
  }

  const cfg = resolved.config;
  if (!cfg) {
    return { reflection: FALLBACK_REFLECTION, fallback: true, crisis: false };
  }

  // Platform-key quota check (Issue #9). User keys (quotaExempt) and crisis
  // (short-circuited above) bypass this entirely.
  if (!resolved.quotaExempt && !canUsePlatformQuota()) {
    return { reflection: QUOTA_EXHAUSTED_REFLECTION, fallback: true, crisis: false };
  }

  const messages = [
    { role: 'system', content: REFLECTION_SYSTEM_PROMPT },
    { role: 'user', content: buildReflectionUserMessage(ctx) },
  ];

  try {
    const response = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.7,
        max_tokens: 300,
        top_p: 0.9,
        stream: false,
      }),
    });

    if (!response.ok) {
      return { reflection: FALLBACK_REFLECTION, fallback: true, crisis: false };
    }

    const data = await response.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;
    if (!content) {
      return { reflection: FALLBACK_REFLECTION, fallback: true, crisis: false };
    }

    // Success — consume one platform-key quota slot (only for platform keys;
    // user keys are exempt). Failed/empty responses do NOT consume quota.
    if (!resolved.quotaExempt) {
      consumePlatformQuota();
    }

    return { reflection: content.trim(), fallback: false, crisis: false };
  } catch {
    return { reflection: FALLBACK_REFLECTION, fallback: true, crisis: false };
  }
}
