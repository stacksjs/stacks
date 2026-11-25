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

An address is one person whatever its case: subscribe() stores it trimmed and
lowercased (normalizeEmail), and subscribe(), unsubscribeAll() and
syncListSubscribers() find rows case-insensitively, so rows stored with capitals
before that still match. A sync skips an address whose row on the list is
unsubscribed under any spelling. subscriberIdsForEmail(email) and
listStatusForEmail(email, listId) are the lookups they share.

## Public signup

Put `<SubscribeForm />` on a page for a newsletter signup; it ships in the
framework defaults (`resources/components/Marketing/SubscribeForm.stx`) and
needs no setup. It is an stx component: it submits in place with a spinner and
shows the answer under the field, and without JavaScript it still posts as a
plain form. Props are all optional: `list` (a public list's slug, else the
default list), `source`, `label`, `placeholder`, `intro`, `fine`,
`successText`, `alreadyText`, `tone` (`primary` or `outline`), `buttonClass`,
`returnTo`, and `outcome`. A plain post comes back with `?subscribe=<outcome>`;
pass it to `outcome` so the page shows the answer on load. Restyle it with the
`--subscribe-*` CSS variables or your own classes; its rules have zero
specificity.

The form posts to `POST /api/email/subscribe` (`SubscriberEmailAction`), which
goes through `subscribe(email, { list, source, publicOnly: true })`: the
signup joins a list, so campaigns reach it. `publicOnly` refuses a list whose
`is_public` is false (`NewsletterListUnavailableError`, answered as a 422), so a
form field never joins an internal list. Outcomes: `subscribed`, `pending`
(double opt-in), `invalid`, `busy` (rate limited) and `error`. An address
already on the list gets the same answer a new one would (`pending` on a double
opt-in list, `subscribed` elsewhere) and no email, so the form cannot be used to
find out who signed up; `already` is no longer sent. A hidden `website` field is
a honeypot: filled in, the request is answered as success and stores nothing. `email.newsletter.signup: false` leaves the signup and confirm routes unmounted (unsubscribe always stays), for a deployment that takes no signups. Scripts get JSON; a browser form post gets a 303 back to `return`
or the Referer. The welcome email carries the membership's own token, so its
unsubscribe link and RFC 8058 headers leave that list only.

`subscribe()` validates with `emailAddress()` and reports `created`,
`reactivated` (signed back up after a per-list or global opt-out),
`subscriberId` and `token`. The legacy global unsubscribe link (a subscriber
uuid) also unsubscribes every list membership, since campaigns send to
memberships.

## Double opt-in

Turn on `doubleOptIn` for a list (`lists.create({ ..., doubleOptIn: true })`
or the dashboard) and its public signups confirm their address first. The
endpoint calls `subscribe()` with `confirmation: 'list'`, so a new or returning
address on such a list is stored `pending` (the membership, and the person if
they are new), the `SubscriptionConfirmRequest` mail sends a
`resources/emails/subscription-confirm.stx` email, and the form answers
`pending` (`pendingText`). Its button opens `GET /api/email/confirm?token=`
(`ConfirmSubscriptionAction`), which calls `confirm(token)`, stamps
`subscribed_at`, and sends the welcome email. Campaigns skip pending
memberships. Signing up again while pending re-sends the email; confirming
twice is harmless; a token that has since unsubscribed is refused.

`subscribe()` without `confirmation: 'list'` (imports, admin adds) subscribes
at once and promotes a pending membership. The auto-created default list is
single opt-in unless `config/email.ts` sets `newsletter: { doubleOptIn: true }`
(read when the first signup creates the list). `email_lists` and
`email_list_subscribers` are not gated by the marketing feature, because the
signup needs them in every app. A default list created by an older release has
`double_opt_in` on; set it off if you do not want confirmation there. The
confirm and unsubscribe routes stay reachable in maintenance and coming-soon
mode, like the signup.

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
