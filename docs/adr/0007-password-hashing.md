# 0007 — Password hashing with scrypt

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Passwords must be stored with a slow, memory-hard KDF. Popular choices are bcrypt, scrypt and
Argon2id.

## Decision

Use **scrypt** from the Node.js standard library (`node:crypto`), with parameters
`N = 2^15 (32768)`, `r = 8`, `p = 1`, a 16-byte random salt and a 64-byte derived key.

Stored format: `scrypt$N$r$p$<salt-base64url>$<hash-base64url>`.

- No native build step: CI does not need a compiler, and there is no platform-specific binary to
  keep patched. This was the deciding factor.
- The KDF is memory-hard and widely reviewed; Node ships it in a maintained core library.
- Verification uses `crypto.timingSafeEqual` on equal-length buffers.
- The parameter set is stored inside the hash, so parameters can be raised later and existing
  hashes keep verifying (rehash on next successful sign-in).

## Alternatives considered

- **bcrypt** — rejected: native binding, 72-byte input limit, and it is not memory-hard.
- **argon2id** (`@node-rs/argon2`) — the preferred choice if Argon2id availability is not a
  concern; it ships prebuilt binaries, which would also have been acceptable. Deferred to a
  post-v1 hardening ADR if the deployment target is confirmed.
- **PBKDF2** — rejected: not memory-hard, lower resistance to GPU cracking.

## Consequences

- Sign-in costs roughly 80–120 ms of CPU on a modern core; this is intentional and is covered by
  the rate limiter.
- Tests that create many users use a reduced-cost parameter set through a test-only environment
  flag; the production default is never lowered.
