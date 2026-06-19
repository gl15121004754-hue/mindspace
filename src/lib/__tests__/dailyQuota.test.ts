/**
 * Unit tests for lib/dailyQuota — the platform-key daily quota state machine
 * (Issue #9). Quota is a weak constraint stored in localStorage; clearing it
 * just lets the user get a few more, which is acceptable per the PRD.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DAILY_QUOTA_LIMIT,
  QUOTA_STORAGE_KEY,
  getQuotaStatus,
  canUsePlatformQuota,
  consumePlatformQuota,
  resetQuota,
} from '../dailyQuota';

const TODAY = new Date('2026-06-19T10:00:00').getTime();
const TOMORROW = new Date('2026-06-20T10:00:00').getTime();

describe('DAILY_QUOTA_LIMIT', () => {
  it('is 3 (platform free daily reflections)', () => {
    expect(DAILY_QUOTA_LIMIT).toBe(3);
  });
});

describe('getQuotaStatus', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a fresh status (count 0, remaining = limit) when nothing stored', () => {
    const status = getQuotaStatus(TODAY);
    expect(status.count).toBe(0);
    expect(status.remaining).toBe(DAILY_QUOTA_LIMIT);
    expect(status.limit).toBe(DAILY_QUOTA_LIMIT);
    expect(status.date).toBe('2026-06-19');
  });

  it('reflects a stored count from the same day', () => {
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify({ date: '2026-06-19', count: 2 }));
    const status = getQuotaStatus(TODAY);
    expect(status.count).toBe(2);
    expect(status.remaining).toBe(1);
  });

  it('resets to zero when the stored date is a different day (cross-day reset)', () => {
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify({ date: '2026-06-18', count: 3 }));
    const status = getQuotaStatus(TOMORROW);
    expect(status.count).toBe(0);
    expect(status.remaining).toBe(DAILY_QUOTA_LIMIT);
    expect(status.date).toBe('2026-06-20');
  });
});

describe('canUsePlatformQuota', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is true while under the limit', () => {
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify({ date: '2026-06-19', count: 2 }));
    expect(canUsePlatformQuota(TODAY)).toBe(true);
  });

  it('is false once the limit is reached', () => {
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify({ date: '2026-06-19', count: 3 }));
    expect(canUsePlatformQuota(TODAY)).toBe(false);
  });

  it('is true again after crossing into a new day', () => {
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify({ date: '2026-06-18', count: 3 }));
    expect(canUsePlatformQuota(TODAY)).toBe(true);
  });
});

describe('consumePlatformQuota', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('increments the count and persists to localStorage', () => {
    consumePlatformQuota(TODAY);
    const stored = JSON.parse(localStorage.getItem(QUOTA_STORAGE_KEY) || '{}');
    expect(stored.count).toBe(1);
    expect(stored.date).toBe('2026-06-19');
  });

  it('accumulates across calls on the same day', () => {
    consumePlatformQuota(TODAY);
    consumePlatformQuota(TODAY);
    consumePlatformQuota(TODAY);
    expect(getQuotaStatus(TODAY).count).toBe(3);
    expect(canUsePlatformQuota(TODAY)).toBe(false);
  });

  it('starts a fresh count on a new day', () => {
    consumePlatformQuota(TODAY);
    consumePlatformQuota(TODAY);
    consumePlatformQuota(TOMORROW); // new day → count should be 1, not 3
    const status = getQuotaStatus(TOMORROW);
    expect(status.count).toBe(1);
    expect(status.remaining).toBe(2);
  });
});

describe('resetQuota', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears the stored quota', () => {
    consumePlatformQuota(TODAY);
    consumePlatformQuota(TODAY);
    resetQuota();
    expect(getQuotaStatus(TODAY).count).toBe(0);
  });
});
