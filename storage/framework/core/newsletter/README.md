# @stacksjs/newsletter

Promotional email + newsletter primitives for Stacks. Sits on top of
`@stacksjs/email` — does not introduce a new transport.

```ts
import { newsletter } from '@stacksjs/newsletter'

// list management
const list = await newsletter.lists.create({ name: 'Weekly Digest', slug: 'weekly' })

// subscribe / unsubscribe (returns the per-list unsubscribe token)
await newsletter.subscribe('jane@example.com', { list: 'weekly', source: 'homepage' })
await newsletter.unsubscribe(token)

// campaigns
const campaign = await newsletter.campaigns.create({
  name: 'May Edition',
  subject: 'What\'s new this month',
  template: 'newsletter-may',
  emailListId: list.id,
})

await newsletter.campaigns.sendNow(campaign.id) // dispatches SendCampaignJob
await newsletter.campaigns.schedule(campaign.id, new Date('2026-05-15T09:00:00Z'))
```

## What this package owns

- `EmailList`, `Campaign`, `CampaignSend`, `EmailListSubscriber` (pivot)
- Per-list, per-subscriber unsubscribe tokens
- `List-Unsubscribe` + `List-Unsubscribe-Post` headers (RFC 8058)
- Chunked send via `SendCampaignJob` → `mail.send()` per recipient

## What this package does NOT own

- Email transports (use `@stacksjs/email` drivers — SES, SendGrid, Mailgun, …)
- Open / click tracking pixels (planned)
- Bounce / complaint webhooks (planned, per driver)
- Drip / automation sequences (planned)
- Provider-side audience sync (planned, opt-in)

## Deliverability checklist

This package can scaffold the headers and unsubscribe loop. Sending reputation
is on you:

- DKIM, SPF, and DMARC must pass on your sending domain
- Warm dedicated IPs gradually if you're sending serious volume
- Honor unsubscribes within the same business day
- Monitor complaint rate (target < 0.1%) — exceeding 0.3% gets you blocked
