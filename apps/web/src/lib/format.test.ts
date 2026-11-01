import { describe, expect, it } from 'vitest';
import { formatDueDate, isOverdue, isSameDay, toDateInputValue } from './format';

describe('formatDueDate', () => {
  it('labels today and tomorrow', () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    expect(formatDueDate(now.toISOString())).toBe('Today');
    expect(formatDueDate(tomorrow.toISOString())).toBe('Tomorrow');
  });

  it('returns null without a date', () => {
    expect(formatDueDate(null)).toBeNull();
    expect(formatDueDate(undefined)).toBeNull();
  });

  it('formats other dates as day and month', () => {
    const date = new Date('2030-05-04T10:00:00.000Z');
    expect(formatDueDate(date.toISOString())).toMatch(/^\d{1,2} [A-Z][a-z]{2}$/);
  });
});

describe('isOverdue', () => {
  it('detects a past date', () => {
    expect(isOverdue(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });

  it('does not flag a future date or a missing date', () => {
    expect(isOverdue(new Date(Date.now() + 60_000).toISOString())).toBe(false);
    expect(isOverdue(null)).toBe(false);
  });
});

describe('isSameDay', () => {
  it('compares calendar days', () => {
    const a = new Date('2030-01-02T01:00:00.000Z');
    const b = new Date('2030-01-02T23:00:00.000Z');
    expect(isSameDay(a, b)).toBe(true);
    expect(isSameDay(a, new Date('2030-01-03T01:00:00.000Z'))).toBe(false);
  });
});

describe('toDateInputValue', () => {
  it('produces a value usable by an input[type=date]', () => {
    expect(toDateInputValue('2030-05-04T10:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toDateInputValue(null)).toBe('');
  });
});
