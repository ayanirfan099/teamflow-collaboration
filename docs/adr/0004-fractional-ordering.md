# 0004 — Fractional ordering for task positions

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Kanban columns hold an ordered list of tasks. A naive implementation stores an integer
`position` and rewrites every following row when a task moves (`UPDATE ... SET position = position
+ 1`). On a busy board that is a write amplification problem and creates lock contention.

## Decision

Store a **fractional ordering key** — a lexicographically sortable base-62 string — in
`tasks.position`. Moving a task computes a new key strictly between its neighbours and writes
exactly one row.

- Ordering is `ORDER BY position ASC, created_at ASC, id ASC`; the tie-breakers make the order
  deterministic even when two keys collide.
- The key generator (`packages/database/src/ordering.ts`) is deterministic and unit tested:
  `generateKeyBetween(null, null)` → first key, `generateKeyBetween(a, b)` → a key `> a` and
  `< b`, and `generateKeyBetween(a, null)` → a key after `a`.
- Concurrent inserts at the same position are resolved by jittering the key (a random digit is
  inserted into the generated key), so two clients that compute the same position do not produce
  identical keys and no ordering information is lost.

## Alternatives considered

- **Integer positions with renumbering** — rejected: every move rewrites the tail of the column.
- **LexoRank** — viable alternative; fractional keys are simpler to generate and to test.
- **Materialized path** — rejected: re-parenting a subtree is expensive and the tree is shallow
  enough that adjacency lists are sufficient.

## Consequences

- Moves are O(1) writes.
- Keys occasionally need compaction when the gap between two neighbours is exhausted; the
  generator widens the key space automatically, and a rare full-column rebalance is implemented
  and tested.
- Keys are opaque to clients: the API never exposes a "position number" to the UI, only the
  resulting order.
