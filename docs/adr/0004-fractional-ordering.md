# 0004 — Sparse ordering for task positions

- **Status:** Accepted
- **Date:** 2026-11-01
- **Updated:** 2026-11-01 (M2 — BigInt gap ordering)

## Context

Kanban columns hold an ordered list of tasks. A naive implementation stores an integer
`position` and rewrites every following row when a task moves (`UPDATE ... SET position = position

- 1`). On a busy board that is a write amplification problem and creates lock contention.

## Decision

Store a **sparse numeric position** in `tasks.position` (a `bigint`) and compute the position of
a task from its neighbours. Inserting or moving a task writes exactly one row; the neighbours
keep their positions, so a drag never renumbers a whole column.

- The stride between two neighbours is `POSITION_STRIDE = 1_000_000_000n`. A new task is placed
  at the midpoint of the gap (`before + (after - before) / 2n`).
- Inserting into an empty column yields `POSITION_STRIDE`; inserting at the top yields
  `first - POSITION_STRIDE`; appending yields `last + POSITION_STRIDE`.
- Ordering is `ORDER BY position ASC, created_at ASC, id ASC`; the tie-breakers make the order
  deterministic even when two positions collide.
- When the gap between two neighbours is exhausted (the midpoint equals one of them), the
  column is **rebalanced**: the tasks of that column are written with even spacing
  (`POSITION_STRIDE * (index + 1)`). Only the touched column is rewritten.
- Positions are `bigint`, so a column can hold `9_223_372_036_854_775_807 / 1e9` inserts
  between two neighbours before a rebalance is needed.

### Create semantics of `afterTaskId`

| `afterTaskId` | Result                                      |
| ------------- | ------------------------------------------- |
| not provided  | the task is appended at the end             |
| `null`        | the task is placed at the top of the column |
| a task id     | the task is placed directly after it        |

## Alternatives considered

- **Integer positions with renumbering** — rejected: every move rewrites the tail of the column.
- **LexoRank / fractional-indexing (base-62 strings)** — the reference implementation is ESM
  only and stores the ordering key in a `text` column. Numeric positions keep the schema simple,
  are directly comparable in SQL and work with the `bigint` column that is already needed for
  large values.
- **Materialized path** — rejected: re-parenting a subtree is expensive and the tree is shallow
  enough that adjacency lists are sufficient.

## Consequences

- Moves are O(1) writes.
- A rare rebalance rewrites a single column; the ordering module is unit tested for the
  midpoint, the top, the end and the exhausted gap.
- Positions are opaque to clients: the API never exposes a "position number" to the UI, only the
  resulting order.
