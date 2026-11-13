---
name: stacks-support
description: Use when connecting an application to HQ.support, issuing customer sessions, creating support conversations, forwarding customer events, or controlling its stx messenger. Covers @stacksjs/support and services.supporthq.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
---

# Native customer support

Read `stacks-hq` for approval, connection credentials and usage reporting.
HQ.support owns its own accounts and billing; no other HQ service grants access.

## Server

Import `createSupportClient` from `@stacksjs/support/server` (or the package root).
Configure `url`, `key`, `readKey` and `project` from the application's
`services.supporthq` configuration. The origin defaults to `https://hq.support`.
`SUPPORTHQ_KEY` and `SUPPORTHQ_READ_KEY` are server secrets. Only the project
identifier is public.

Call `createSession` with `externalId` derived from the authenticated server
request. Send only the selected name, email, company and attributes. Give the
returned customer token to the messenger as a property, never an HTML attribute.
An arbitrary browser-supplied user ID is not authentication.

`track`, `conversations.create` and `conversations.reply` require an
`idempotencyKey`. Reuse it when retrying the same operation. The client never
automatically retries writes because a timeout may occur after persistence.
`conversations.list` reads project-scoped summaries with the read key when
available. A read key does not grant full transcript access.

`SupportError` exposes a safe `code` and HTTP `status`. Handle quota exhaustion,
expired credentials, network failures and uncertain writes explicitly. Error
messages exclude provider response bodies and secrets.

## Browser

Import `createSupportBrowser` from `@stacksjs/support/browser`. Supply a compiled
messenger instance implementing `boot/open/close/update/track/shutdown`.
Load the versioned stx element bundle separately. No document or window globals
are needed merely to import the lifecycle client.

`boot({ project, endpoint?, sessionToken?, locale? })` initializes the widget.
Always `shutdown()` on logout, account change, or tenant change. Booting a new
identity clears the old widget first. Never forward a server integration key.

## Verification

Use `createFakeSupportService` from `@stacksjs/support/testing` and pass its
`fetch` to the real client. It exercises wire contracts, scoped authentication,
and idempotency without a port. It is test-only and provides no production
persistence, metering, provider delivery, or identity verification.

Test through the public client and the built package subpaths. Customer flows
also require actual app route/database tests and the emitted stx widget running
in a plain host. Package tests alone do not prove the hosted product is ready.
