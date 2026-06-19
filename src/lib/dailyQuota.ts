/**
 * Platform-key daily quota state machine (Issue #9).
 *
 * The daily AI reflection is free for users without their own API key, funded by
 * the platform key. To keep cost bounded, platform-key reflections are capped at
 * DAILY_QUOTA_LIMIT per device per day. Users who configure their own key are
 * exempt (unlimited). Crisis interventions never consume quota (they don't call
 * the model at all — see generateReflection).
 *
 * Stored in localStorage as a weak constraint: a user clearing it just gets a
 * few more free reflections, which is acceptable (it is a cost control, not a
 * security boundary).
 */

/** Free platform-key reflections per device per day. */
export const DAILY_QUOTA_LIMIT = 3;

export const QUOTA_STORAGE_KEY = 'mindspace_daily_quota';

interface StoredQuota {
  date: string; // 'YYYY-MM-DD' in local time
  count: number;
}

export interface QuotaStatus {
  date: string;
  count: number;
  remaining: number;
  limit: number;
}

/** Format a timestamp as a local-time 'YYYY-MM-DD' string. */
function dayKey(now: number): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function readStored(): StoredQuota | null {
  try {
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredQuota;
    if (typeof parsed.date !== 'string' || typeof parsed.count !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(quota: StoredQuota): void {
  try {
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(quota));
  } catch {
    // localStorage may be unavailable (private mode); quota degrades to
    // "always allow" — acceptable for a cost control, not a security control.
  }
}

/**
 * Current quota status for today. If the stored date differs from today, the
 * count is treated as 0 (cross-day reset).
 */
export function getQuotaStatus(now: number = Date.now()): QuotaStatus {
  const today = dayKey(now);
  const stored = readStored();
  const count = stored && stored.date === today ? stored.count : 0;
  return {
    date: today,
    count,
    remaining: Math.max(0, DAILY_QUOTA_LIMIT - count),
    limit: DAILY_QUOTA_LIMIT,
  };
}

/** True if a platform-key reflection can still be made today. */
export function canUsePlatformQuota(now: number = Date.now()): boolean {
  return getQuotaStatus(now).count < DAILY_QUOTA_LIMIT;
}

/**
 * Record one platform-key reflection usage. Increments today's count (starting
 * from 0 if it is a new day).
 */
export function consumePlatformQuota(now: number = Date.now()): void {
  const today = dayKey(now);
  const stored = readStored();
  const count = stored && stored.date === today ? stored.count : 0;
  writeStored({ date: today, count: count + 1 });
}

/** Clear the stored quota (e.g. for testing or a manual reset). */
export function resetQuota(): void {
  try {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
  } catch {
    // ignore
  }
}
