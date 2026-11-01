import { describe, expect, it } from 'vitest';
import {
  MAX_POSITION,
  POSITION_STRIDE,
  positionAtEnd,
  positionAtStart,
  positionBetween,
  rebalancedPositions,
} from './ordering';

describe('positionBetween', () => {
  it('places the first task at the stride', () => {
    const result = positionBetween({ before: null, after: null });
    expect(result).toEqual({ kind: 'position', position: POSITION_STRIDE });
  });

  it('places a task at the top of a column', () => {
    const result = positionBetween({ before: null, after: POSITION_STRIDE });
    expect(result).toEqual({ kind: 'position', position: 0n });
  });

  it('places a task at the end of a column', () => {
    const result = positionBetween({ before: POSITION_STRIDE, after: null });
    expect(result).toEqual({ kind: 'position', position: POSITION_STRIDE * 2n });
  });

  it('places a task between two neighbours', () => {
    const result = positionBetween({ before: 0n, after: POSITION_STRIDE });
    expect(result.kind).toBe('position');
    if (result.kind === 'position') {
      expect(result.position).toBe(POSITION_STRIDE / 2n);
      expect(result.position).toBeGreaterThan(0n);
      expect(result.position).toBeLessThan(POSITION_STRIDE);
    }
  });

  it('asks for a rebalance when the gap is exhausted', () => {
    const result = positionBetween({ before: 0n, after: 1n });
    expect(result).toEqual({ kind: 'rebalance' });
  });

  it('asks for a rebalance when the neighbours are inverted', () => {
    const result = positionBetween({ before: POSITION_STRIDE, after: 0n });
    expect(result).toEqual({ kind: 'rebalance' });
  });

  it('asks for a rebalance at the edge of the bigint range', () => {
    const result = positionBetween({ before: MAX_POSITION, after: null });
    expect(result).toEqual({ kind: 'rebalance' });
  });
});

describe('rebalancedPositions', () => {
  it('spaces the positions evenly', () => {
    expect(rebalancedPositions(3)).toEqual([
      POSITION_STRIDE,
      POSITION_STRIDE * 2n,
      POSITION_STRIDE * 3n,
    ]);
  });

  it('returns an empty list for an empty column', () => {
    expect(rebalancedPositions(0)).toEqual([]);
  });
});

describe('positionAtStart and positionAtEnd', () => {
  it('handles an empty column', () => {
    expect(positionAtStart(null)).toEqual({ kind: 'position', position: POSITION_STRIDE });
    expect(positionAtEnd(null)).toEqual({ kind: 'position', position: POSITION_STRIDE });
  });
});
