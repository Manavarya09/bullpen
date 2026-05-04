---
name: idempotent-apis
description: Use when designing or reviewing any state-changing HTTP endpoint (POST, PUT, PATCH, DELETE) — covers idempotency keys, request deduplication, retry safety, exactly-once semantics over at-least-once delivery, and the Stripe/standard idempotency-key pattern. Use anytime an endpoint creates resources, charges money, sends notifications, or has any non-reversible side effect.
---

# Idempotent APIs — make every endpoint retry-safe

The internet retries. Phones retry. Webhook senders retry. Service meshes retry. **If your endpoint isn't idempotent, you have a duplicate-charge / duplicate-email / duplicate-record bug waiting to surface.** This skill is the playbook to make it not surface.

## When to use this skill

- Designing any new POST / PUT / PATCH / DELETE
- Reviewing an endpoint that touches money, messaging, or external services
- Debugging "why did the user get charged twice" / "why did we send 3 emails"
- Migrating from at-most-once to at-least-once delivery (and the implied exactly-once needs)
- Adding webhook receivers (always at-least-once from the sender side)

## Iron law

**Every state-changing endpoint MUST be safe to call twice with the same input and produce the same result without duplicating side effects.**

This isn't a "nice-to-have." A retry happens. A network blip happens. A user double-clicks. If your endpoint isn't idempotent, the bug is when, not if.

## The pattern (Stripe-style — battle tested)

### Client side
1. Generate a unique idempotency key per logical operation (UUIDv4 or ULID).
2. Send it in `Idempotency-Key` header.
3. On retry, send the SAME key. Different keys = different operations.
4. Reuse the key for ~24h, then garbage-collect.

### Server side
1. Look up the key in a `request_dedup` table (Postgres + index on key works fine until ~10k req/s).
2. **First call:** insert key + (status: in_progress) + start the operation. On success, store the response. On failure, store the error. Either way, return.
3. **Repeat call with same key:**
   - If `in_progress` → return 409 Conflict with `Retry-After` header.
   - If `completed` → return the cached response.
   - If `failed` → return the cached error.
4. **TTL the dedup table** — 24h is industry standard. Older keys can be retried as fresh.

### Schema
```sql
CREATE TABLE request_dedup (
  key VARCHAR(255) PRIMARY KEY,
  status VARCHAR(32) NOT NULL,         -- 'in_progress' | 'completed' | 'failed'
  request_hash VARCHAR(64) NOT NULL,   -- detect "same key, different body" abuse
  response_body JSONB,
  status_code INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_request_dedup_created ON request_dedup(created_at);
```

### Pseudocode (Node.js, transport-agnostic)
```ts
async function handle(req) {
  const key = req.headers['idempotency-key'];
  if (!key) return error(400, 'Idempotency-Key required');

  const bodyHash = sha256(req.rawBody);
  const existing = await db.dedup.findByKey(key);

  if (existing) {
    if (existing.request_hash !== bodyHash) {
      return error(422, 'Idempotency-Key reused with different body');
    }
    if (existing.status === 'in_progress') {
      return error(409, 'Request still in progress', { 'Retry-After': '5' });
    }
    return reply(existing.status_code, existing.response_body);
  }

  await db.dedup.create({ key, status: 'in_progress', request_hash: bodyHash });

  try {
    const result = await doTheWork(req.body);
    await db.dedup.update(key, { status: 'completed', response_body: result, status_code: 200 });
    return reply(200, result);
  } catch (e) {
    const errBody = serializeError(e);
    await db.dedup.update(key, { status: 'failed', response_body: errBody, status_code: 500 });
    throw e;
  }
}
```

## When idempotency is "free"

Some operations are naturally idempotent — no key needed:
- **PUT /users/{id}** with full replacement body — same body always produces same state.
- **DELETE /resources/{id}** — second call returns 404 or 204; either is fine.
- **GET / HEAD** — read-only, always idempotent.

But:
- **POST /payments** is NOT — without a key, retry charges twice.
- **POST /messages** is NOT — without a key, retry sends twice.
- **PATCH /counter (increment)** is NOT — patches that mutate based on current state need keys.

## Anti-patterns

| Anti-pattern | Why it's wrong | Fix |
|---|---|---|
| Skipping idempotency on "internal" POSTs | Retries happen even on internal networks (mesh retries, K8s restarts) | Always idempotent for state-changing ops |
| Using the request body hash as the key | Two legitimate identical requests get deduped incorrectly | Client-generated unique key, server stores both key + body hash |
| No TTL on the dedup table | Unbounded growth, slow queries | TTL 24-48h, partition by date |
| 200 OK on duplicate without indication | Client can't tell if it actually succeeded | Same response — explicit cache hit is fine, but don't lie about a fresh op |
| Idempotency check happens AFTER the side effect | Defeats the whole purpose | Lock the key BEFORE doing work |
| Different key per retry | Defeats deduplication | Client persists the key for the operation, reuses on retry |
| Returning 200 when status is `in_progress` | Caller assumes success and doesn't retry the GET to fetch the result | 409 with Retry-After |

## Database choices

| Backend | OK at | Notes |
|---|---|---|
| Postgres unique index + UPSERT | <10k req/s | Default. Add the dedup TTL via a daily job. |
| Redis with NX (SET NX EX 86400) | <100k req/s | Fast, but lose data on Redis restart unless AOF/RDB tuned. |
| DynamoDB conditional put | Unlimited (pay) | Native TTL. AWS-only. |
| Cassandra w/ TTL | Unlimited (run) | Own the cluster. |

## Webhook receivers — same problem, harder

Webhook senders (Stripe, GitHub, Shopify) **always** retry on non-2xx. So:
1. **Verify signature** before any DB work (HMAC with the shared secret).
2. **Treat the event ID as the idempotency key** — Stripe sends `evt_xxx`, GitHub sends `X-GitHub-Delivery`, etc.
3. **Acknowledge fast (200 within ~3s)** — defer the actual work to a queue / job.
4. **Mark the event ID processed in your dedup table** before queueing — so a retry doesn't enqueue twice.

## Verification checklist

- [ ] Endpoint requires `Idempotency-Key` header (or has natural idempotency)
- [ ] Key is checked + locked BEFORE side effects start
- [ ] Cached response is returned for repeat keys
- [ ] In-progress state returns 409 + Retry-After
- [ ] Different body with same key returns 422
- [ ] Dedup table has TTL (24-48h) and is index-supported
- [ ] Race: two simultaneous identical requests → only one runs (verified with concurrent test)
- [ ] Failed operations cache the failure too (so retries don't keep re-trying immediately)
- [ ] Webhook receivers verify signature first, then dedup on event ID
- [ ] Test: retry the same call 5x in flight → same result, 1 side effect

## When stuck

- "What if the operation succeeded but the dedup write failed?" → Use a transaction that wraps both. If the DB doesn't support that across services, use the outbox pattern.
- "What if I need exactly-once across multiple services?" → You can't have it. Embrace at-least-once + idempotency at every consumer.
- "What about long-running jobs?" → The dedup record stores the job ID; subsequent calls return the same job ID and the client polls it.
- **Hand off to Bastion (Security Engineer)** if the dedup logic touches sensitive data — there are subtle attacks (key-reuse with different scope) worth a review.
- **Hand off to Vault (Database Engineer)** if write throughput exceeds what your current backend can handle.
