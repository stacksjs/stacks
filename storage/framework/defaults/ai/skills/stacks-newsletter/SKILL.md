---
name: stacks-newsletter
description: Use when managing native subscriber lists, opt-in/unsubscribe, campaigns, scheduled delivery, variants, idempotency, or delivery usage. Covers @stacksjs/newsletter and the native marketing bundle.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Native newsletters and campaigns

The newsletter facade exposes lists, campaigns, subscribe, unsubscribe and
unsubscribeAll. This is the application delivery API; marketing copy and
strategy skills do not replace its consent, state and failure contracts.

## Lifecycle

Use subscribe(email, options) and token-based unsubscribe rather than raw
subscriber updates. Preserve one-click unsubscribe headers and suppression.
List/campaign helpers own their schema and state transitions; direct column
writes can bypass transition guards or schedule/idempotency behavior.

Campaign delivery snapshots, dispatch keys and state conflict errors protect
retries and concurrent queue requests. Scheduled work uses the package's actual
transition and readiness checks. DeliveryVariant allocation and
deliveryIdempotencyKey make repeated delivery explicit; usage limits and failure
classification distinguish deferred, failed and suppressed outcomes.

The transport uses configured email delivery and queue infrastructure. A queued
campaign is not proof that a provider delivered every message. Persist results,
handle webhooks according to the provider contract and respect opt-out state.
Enable/install the marketing bundle and migrate its models before persistence.

Prepare a draft or analysis within the request. Sending or scheduling a campaign
requires authorization for its recipients and scope. Reuse existing authorization
without asking again for each already-approved step.

Source: core/newsletter/src/{newsletter,lists,subscriptions,campaigns,delivery,
headers,sync,usage}.ts. Tests cover subscriptions, transition races, idempotency,
delivery usage and failure behavior.
