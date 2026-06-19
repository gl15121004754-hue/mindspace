/**
 * Shared crisis detection + intervention (Issue #8).
 *
 * Extracted from enhancedChatService.ts so the chat path and the daily-record
 * path use identical keywords, hotline, and intervention copy. Previously this
 * logic lived unexported inside the chat service and the hotline number was
 * duplicated across files.
 *
 * Detection is conservative substring matching — it errs toward flagging.
 * When in doubt, surface the intervention; the cost of a false positive is low
 * (a kind message + a hotline), the cost of a false negative is high.
 */

/** National 24h psychological crisis intervention hotline (China). */
export const CRISIS_HOTLINE = '400-161-9995';

export type CrisisType = 'panic' | 'self_harm';

export interface CrisisDetectionResult {
  crisis: boolean;
  type?: CrisisType;
}

/**
 * Crisis keywords. self_harm is checked first so it takes precedence when a
 * message matches both (e.g. "崩溃了，不想活了" → self_harm).
 *
 * Keep these in sync with enhancedChatService.ts (which now imports from here).
 */
const CRISIS_KEYWORDS: Record<CrisisType, string[]> = {
  panic: ['喘不上气', '手在抖', '心跳好快', '要疯了', '崩溃', '惊恐'],
  self_harm: ['不想活了', '想结束', '想死', '自杀', '自残'],
};

/**
 * Detect crisis signals in free text. Pure function, no side effects.
 */
export function detectCrisis(text: string): CrisisDetectionResult {
  const lower = (text || '').toLowerCase();

  for (const keyword of CRISIS_KEYWORDS.self_harm) {
    if (lower.includes(keyword)) {
      return { crisis: true, type: 'self_harm' };
    }
  }

  for (const keyword of CRISIS_KEYWORDS.panic) {
    if (lower.includes(keyword)) {
      return { crisis: true, type: 'panic' };
    }
  }

  return { crisis: false };
}

/**
 * Build the crisis intervention message shown instead of a normal AI reply.
 *
 * - self_harm: warm, affirms the person, surfaces the hotline.
 * - panic: points to the SOS breathing exercise (no hotline needed).
 *
 * Deterministic (no random selection) so it is unit-testable and so the daily
 * record path — which archives this to aiReflection — stores a stable message.
 */
export function buildCrisisIntervention(type: CrisisType): string {
  if (type === 'self_harm') {
    return [
      '我听到了你此刻的痛苦，这一刻一定很难熬。',
      '你不是一个人，请给自己一个机会。',
      `如果需要专业支持，可以拨打心理援助热线：${CRISIS_HOTLINE}`,
    ].join('\n');
  }
  // panic
  return [
    '感受到你现在的紧张和难受，这一刻被看见了。',
    '可以先做一次 60 秒的急救练习，让身体慢慢缓下来。',
    '下面有「现在很难受」入口，可以随时进入 SOS。',
  ].join('\n');
}
