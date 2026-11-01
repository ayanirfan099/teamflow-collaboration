/**
 * Sparse ordering for tasks inside a column.
 *
 * A task stores a numeric position between its neighbours. Inserting or moving a task only
 * writes that one row — the neighbours keep their positions, so a drag never renumbers a
 * whole column.
 */

export const POSITION_STRIDE = 1_000_000_000n;

/** The largest position Postgres can safely store in a `bigint`. */
export const MAX_POSITION = 9_223_372_036_854_775_807n;
const MIN_POSITION = -MAX_POSITION;

export type PositionResult = { kind: 'position'; position: bigint } | { kind: 'rebalance' };

/**
 * Computes the position between two neighbours.
 *
 * `before` is the task the new task is placed after, `after` the task it is placed before.
 * When the gap is too small the column has to be rebalanced first.
 */
export function positionBetween(input: {
  before: bigint | null;
  after: bigint | null;
}): PositionResult {
  const { before, after } = input;

  if (before === null && after === null) {
    return { kind: 'position', position: POSITION_STRIDE };
  }
  if (before === null) {
    // Insert at the top of the column.
    const position = after! - POSITION_STRIDE;
    if (position <= MIN_POSITION) {
      return { kind: 'rebalance' };
    }
    return { kind: 'position', position };
  }
  if (after === null) {
    const position = before + POSITION_STRIDE;
    if (position >= MAX_POSITION) {
      return { kind: 'rebalance' };
    }
    return { kind: 'position', position };
  }

  if (after <= before) {
    return { kind: 'rebalance' };
  }
  const midpoint = before + (after - before) / 2n;
  if (midpoint === before || midpoint === after) {
    // The gap is exhausted.
    return { kind: 'rebalance' };
  }
  return { kind: 'position', position: midpoint };
}

/** The position for a task that is appended at the end of a column. */
export function positionAtEnd(last: bigint | null): PositionResult {
  return positionBetween({ before: last, after: null });
}

/** The position for a task that is placed at the top of a column. */
export function positionAtStart(first: bigint | null): PositionResult {
  return positionBetween({ before: null, after: first });
}

/** Evenly spaced positions for a column that is rebalanced. */
export function rebalancedPositions(count: number): bigint[] {
  const positions: bigint[] = [];
  for (let index = 0; index < count; index += 1) {
    positions.push(POSITION_STRIDE * BigInt(index + 1));
  }
  return positions;
}
