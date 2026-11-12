---
title: Software Licensing
description: "Sell software licenses from a Stacks app: issue a key from the payment webhook, limit devices, assign team seats, and verify a signed offline token in a desktop app."
---
# Software Licensing

Licensing is part of the Commerce package. It turns a paid checkout into a license key, tracks which devices use it, and gives a desktop app a signed token it can verify with no network.

It has two halves:

```ts
import { licensing } from '@stacksjs/commerce' // on your server
import { createLicenseClient } from '@stacksjs/commerce/licensing/client' // in your desktop app
```

The client entry depends on nothing but `node:crypto`, so it compiles into a Bun agent without your models or database.

## Tiers

| Tier | Updates | Expires | What the buyer gets |
|---|---|---|---|
| `standard` | 1 year | never | Every version released within a year of purchase, kept for good. |
| `lifetime` | all | never | Every version, for good. |
| `team` | all | after 1 year | Every version while the license runs, for a number of seats. |

Each license allows 2 devices by default (per seat on a team license). A tier does not set a price: you charge what you like, in integer cents.

## Setup

Generate the signing keypair:

```bash
buddy license:keygen
```

Put the private half in your server's environment and embed the public half in your app:

```bash
LICENSE_SIGNING_KEY=ed25519-private:...
LICENSE_SIGNING_KEY_ID=license-2026-11-11
```

Licensing's tables belong to the commerce feature. Enable it if you have not, then apply the migrations:

```bash
buddy commerce:install
```

```bash
buddy migrate
```

The licensing routes mount on their own once `LICENSE_SIGNING_KEY` is set. An app that names its route bundles adds `licensing` to `STACKS_DEFAULT_ROUTES`.

## Selling a license

Start a checkout with a license purchase reference. Every payment driver echoes a checkout's reference in its webhook, so this works the same on Stripe, Paddle, Lemon Squeezy and Adyen.

```ts
import { licensing } from '@stacksjs/commerce'
import { paymentDriver } from '@stacksjs/payments'

const reference = licensing.licensePurchaseReference({ tier: 'standard' })

const session = await paymentDriver().checkout(payer, {
  mode: 'payment',
  lines: [{ name: 'Pro', unitAmount: 3900, quantity: 1 }],
  successUrl: `https://example.com/thanks?purchase=${reference}`,
  reference,
})
```

When the payment provider calls `POST /webhooks/payments`, the framework issues the license and emails the key. Issuing is idempotent per purchase: a retried webhook, or a second event about the same checkout, finds the license that already exists.

Show the key on your thank-you page:

```ts
const license = await licensing.findLicenseByPurchase(reference)
```

A refund of the payment revokes the license once it covers what was paid. A partial refund is recorded and leaves the license active.

To issue a license without a payment, call `issueLicense` with any unique reference:

```ts
const { license } = await licensing.issueLicense({
  purchaseReference: 'grant-2026-0042',
  tier: 'lifetime',
  email: 'friend@example.com',
})
```

## Routes

| Route | Body | Answers |
|---|---|---|
| `POST /licenses/activate` | `key`, `deviceHash`, `deviceName`, `platform`, `appVersion`, `email` (team) | `{ ok, token, license }`, or 409 `device-limit` with the `devices` in use |
| `POST /licenses/deactivate` | `key`, `deviceHash` | `{ ok, released }` |
| `POST /licenses/check` | `key`, `deviceHash`, `appVersion` | `{ ok, valid, token, license }` or `{ ok, valid: false, reason }` |
| `POST /licenses/resend` | `email` | The same answer whether or not the address bought anything |
| `POST /licenses/transfer` | `key`, `email`, `toEmail` | `{ ok, email }` |
| `GET`, `POST`, `DELETE /licenses/seats` | `key`, `userId` | Signed-in owner or admin of the license's team |

To change a route, define the same method and path in `routes/api.ts`.

## In your desktop app

```ts
import { createLicenseClient } from '@stacksjs/commerce/licensing/client'

const license = createLicenseClient({
  endpoint: 'https://example.com/licenses',
  publicKeys: { 'license-2026-11-11': 'ed25519-public:...' },
  buildDate: '2026-11-11T00:00:00.000Z',
  storage: {
    get: name => Bun.secrets.get({ service: 'com.example.app', name }),
    set: (name, value) => Bun.secrets.set({ service: 'com.example.app', name, value }),
    delete: name => Bun.secrets.delete({ service: 'com.example.app', name }),
  },
})
```

`storage` is any object with `get`, `set` and `delete`. `buildDate` is the release date of the running build, written in at build time.

### Activate

```ts
const result = await license.activate(key, {
  id: deviceId,
  name: 'Studio MacBook Pro',
  platform: process.platform,
  appVersion: '1.4.0',
})

if (!result.ok && result.reason === 'device-limit') {
  // result.devices: [{ name, platform, lastSeenAt }]
}
```

Only the SHA-256 of the device id is sent.

### Check standing

```ts
const standing = await license.standing()

if (standing.pro) {
  // unlock paid features
}
```

`standing()` reads the stored token and never throws for a network failure.

- It asks the server again 7 days after the last successful check.
- A standard or lifetime license never expires for the builds it covers, online or offline.
- A license that can end (a team license) works offline for 30 days after its last check.
- `pro` is true for a lifetime license, and for any other license when the build was released on or before `updatesUntil`.

### Release a device

```ts
await license.release()
```

This frees the device's slot so the key can be activated somewhere else.

## Team seats

A team license belongs to a `Team` and covers a number of seats. A seat goes to an active member of that team:

```ts
await licensing.assignLicenseSeat({ key, userId })
await licensing.unassignLicenseSeat({ key, userId })
const seats = await licensing.licenseSeats(key)
```

A member activates with the email address of their seat. Each seat has its own device limit. Removing a seat releases its devices.

## The license email

The default email is `resources/emails/license.stx`, built on `EmailLayout`. Copy it into your app's `resources/emails/` to change it, or send your own:

```ts
licensing.configureLicensing({
  onIssued: async (license) => {
    // send your email
  },
})
```

## Verifying a token yourself

```ts
import { isEntitled, verifyToken } from '@stacksjs/commerce/licensing/client'

const payload = verifyToken(token, publicKeys)
const unlocked = isEntitled(payload, buildDate)
```

`verifyToken` throws a `LicenseTokenError` whose `reason` is `malformed`, `unknown-key`, `bad-signature` or `wrong-device`.
