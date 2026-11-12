---
name: stacks-licensing
description: Use when selling software licenses from a Stacks app - issuing a license key from a payment webhook, device activations and limits, team seats, refund revocation, resend and transfer, the Ed25519-signed offline license token, or the desktop license client with offline grace. Covers the licensing module of @stacksjs/commerce and @stacksjs/commerce/licensing/client.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Software licensing

Licensing is part of `@stacksjs/commerce`. The server half issues and tracks
licenses; the client half runs inside a desktop app's agent and answers "are
paid features unlocked for this build?" with no network.

```ts
import { licensing } from '@stacksjs/commerce' // server
import { createLicenseClient } from '@stacksjs/commerce/licensing/client' // desktop agent
```

The client entry imports only `node:crypto`. Never import the package barrel
into a compiled agent: it pulls in the database and the models.

## Key paths

- Server: `storage/framework/core/commerce/src/licensing/` (`service.ts`,
  `keys.ts`, `resend.ts`, `token.ts`)
- Client: `storage/framework/core/commerce/src/licensing/client.ts`
- Models: `LicenseKey`, `LicenseActivation`, `LicenseSeat` in
  `storage/framework/defaults/app/Models/commerce/`
- Actions: `storage/framework/defaults/app/Actions/Commerce/Licensing/`
- Routes: `storage/framework/defaults/routes/licensing.ts`, and the payment
  webhook in `routes/payments.ts`
- Email: `defaults/app/Mail/LicenseEmail.ts`, `defaults/resources/emails/license.stx`
- Tests: `core/commerce/src/tests/licensing.test.ts`, `licensing-token.test.ts`

## Tiers

| Tier | `updatesUntil` | `expiresAt` | Meaning |
|---|---|---|---|
| `standard` | issue date + 1 year | null | Builds released on or before `updatesUntil` stay unlocked for good (perpetual fallback). |
| `lifetime` | null | null | Every build, never expires. |
| `team` | null | issue date + 1 year | Every build while it runs, `seats` people. Renew with `extendLicense`. |

`maxDevices` defaults to 2 (per seat on a team license). Prices are not stored
on the tier: charge what you like, in integer cents, and pass the tier in the
purchase reference.

## Setup

1. `buddy license:keygen` prints an Ed25519 keypair. Set `LICENSE_SIGNING_KEY`
   and `LICENSE_SIGNING_KEY_ID` in the server's environment. Embed the public
   half in the app as `{ [keyId]: 'ed25519-public:...' }`.
2. Licensing's tables belong to the `commerce` feature: enable it first
   (`buddy commerce:install`), or their migrations are skipped. Then
   `buddy migrate` creates `license_activations` and `license_seats` and adds
   the license columns to `license_keys`.
3. The licensing routes mount when `LICENSE_SIGNING_KEY` is set (or when
   `STACKS_DEFAULT_ROUTES` names `licensing`). The webhook is the `payments`
   bundle.

## Selling a license

Start a checkout whose `reference` is a license purchase reference. Every
payment driver echoes the reference in its webhook, which is how issuing works
with any driver.

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

`POST /webhooks/payments` then calls `licensing.handleLicensePaymentEvent(event)`
for every verified event:

- `checkout.completed` or `payment.succeeded` with a license reference issues
  the license once (`license_keys.purchase_reference` is unique). A second
  event for the same purchase fills in the buyer's address or the payment id
  and never issues again.
- `refund.succeeded` for the license's payment adds to `amount_refunded`; once
  it covers `amount_paid` the license becomes `refunded` and stops checking in
  as valid. A retry is applied once.

The buyer's address comes from the event (`buyerEmailFromEvent`: checkout
`metadata.email` on any driver, otherwise where Stripe, Lemon Squeezy and Adyen
state it). The thank-you page reads the key with
`licensing.findLicenseByPurchase(reference)`.

To issue outside a webhook (a grant, a migration from another system) call
`licensing.issueLicense({ purchaseReference, tier, email })` with any unique
reference.

## Server functions

| Function | Does |
|---|---|
| `issueLicense(input)` | The license for a purchase, created on first sight. Returns `{ license, created }`. |
| `handleLicensePaymentEvent(event)` | Issue or refund from a `PaymentEvent`. Returns `{ action, license? }`. |
| `activateLicense({ key, deviceHash, deviceName, platform, appVersion, email? })` | Take a device slot, answer a token. Beyond `maxDevices`: `device-limit` with the devices in use. |
| `deactivateLicense({ key, deviceHash })` | Release a device's slot. |
| `checkLicense({ key, deviceHash, appVersion? })` | Standing plus a fresh token, or `{ valid: false, reason }`. |
| `transferLicense({ key, fromEmail, toEmail })` | New owner address, every device released, key emailed. |
| `revokeLicense(key)` / `extendLicense(key, until)` | Stop or renew a license by hand. |
| `assignLicenseSeat({ key, userId })` / `unassignLicenseSeat` / `licenseSeats(key)` | Team seats. The user must be an active `TeamMember` of the license's `Team`. |
| `activeLicensesFor(email)` / `requestLicenseResend(email, deps)` | Resend by email, rate limited, same answer whether or not the address bought anything. |
| `findLicenseByKey` / `findLicenseByPurchase` / `licenseDevices` | Lookups. |
| `configureLicensing({ onIssued, signingKey, now, termYears })` | Process-wide defaults. `onIssued` replaces the default license email. |

Every function takes an optional last argument with the same options, which is
how tests pin the clock and the signing key.

A team license needs `teamId` at issue (or set `team_id` afterwards). A member
activates with the email of their seat; each seat has its own device limit.

## Routes

| Route | Action | Notes |
|---|---|---|
| `POST /licenses/activate` | `LicenseActivateAction` | `{ key, deviceHash, deviceName?, platform?, appVersion?, email? }`. 409 `device-limit` lists `devices`. |
| `POST /licenses/deactivate` | `LicenseDeactivateAction` | `{ key, deviceHash }` |
| `POST /licenses/check` | `LicenseCheckAction` | Always 200 with `valid`; a 5xx means "ask again later". |
| `POST /licenses/resend` | `LicenseResendAction` | `{ email }`. 3 per address and 10 per IP an hour. |
| `POST /licenses/transfer` | `LicenseTransferAction` | `{ key, email, toEmail }` |
| `GET, POST, DELETE /licenses/seats` | `LicenseSeat*Action` | `auth` middleware; the caller must be an `owner` or `admin` of the license's team. |

The first three are CSRF-exempt (the key is the credential) and rate limited.
A 503 `not-configured` means the signing key is missing.

## The token

`<base64url payload>.<base64url Ed25519 signature>`. The payload:

```ts
{ v: 1, kid, licenseId, tier, updatesUntil, expiresAt, deviceHash, issuedAt, checkBy }
```

`licenseId` is the license's uuid, never the key. `deviceHash` is the SHA-256
of the device id, so the id never leaves the device. `checkBy` is 30 days after
`issuedAt`. Keys and signatures use the encodings of the desktop updater
(`@stacksjs/desktop` `updater.ts`): `ed25519-public:<base64url SPKI DER>`,
`ed25519-private:<base64url PKCS#8 DER>`, trusted keys as `{ keyId: publicKey }`.

- `signLicenseToken(input, { privateKey, keyId })`
- `verifyLicenseToken(token, publicKeys, deviceHash?)` throws a
  `LicenseTokenError` whose `reason` is `malformed`, `unknown-key`,
  `bad-signature` or `wrong-device`.
- `isEntitled({ tier, updatesUntil }, buildDate)` is the entitlement rule:
  true for `lifetime` or a null `updatesUntil`, otherwise true exactly when
  the build was released on or before `updatesUntil`.
- `tokenStanding(payload, { buildDate, now, lastCheckedAt })` applies the
  clock: `{ licensed, pro, reason, perpetual, recheckDue }`.

## The client

```ts
const license = createLicenseClient({
  endpoint: 'https://example.com/licenses',
  publicKeys: { 'license-2026': 'ed25519-public:...' },
  buildDate: BUILD_DATE, // the release date baked into this build
  storage: {
    get: name => Bun.secrets.get({ service: 'com.example.app', name }),
    set: (name, value) => Bun.secrets.set({ service: 'com.example.app', name, value }),
    delete: name => Bun.secrets.delete({ service: 'com.example.app', name }),
  },
})

const result = await license.activate(key, { id: deviceId, name: hostname, platform: process.platform, appVersion })
if (!result.ok && result.reason === 'device-limit')
  showDevicesInUse(result.devices)

const { pro } = await license.standing() // the only thing a feature gate needs
await license.release() // give this device's slot back
```

`standing()` never throws for a network failure. Its rules:

- It asks the server again when 7 days have passed since the last successful
  check, and stores the fresh token.
- A token for a license that is owned outright (`expiresAt` null: standard and
  lifetime) never expires for the builds it covers, online or not.
- Any other token works offline until `checkBy` (30 days), then answers
  `check-overdue` until a check succeeds.
- A definite "no" from the server (`revoked`, `refunded`, `released`) clears
  the stored license. A 5xx or an unreachable server changes nothing.
- `pro` is `licensed` and `isEntitled(token, buildDate)`. A standard license on
  a build released after `updatesUntil` is `licensed: true, pro: false`.

`verifyToken(token, publicKeys)` is exported standalone.

## Gotchas

- Bake `buildDate` at release time. Reading the clock at runtime instead makes
  every old build look new and locks standard licenses out after a year.
- The public key map is the trust root. Rotate by shipping a build that trusts
  both ids before switching the server's private key.
- Send the device hash, never the id: `hashDeviceId(id)` on the client. The
  server refuses anything that is not a 64-character hex SHA-256.
- Do not add a `useApi` route for `LicenseActivation` or `LicenseSeat`: a
  direct write skips the device and seat limits.
- A refunded or revoked perpetual license keeps working on a device that never
  comes online again. That is the cost of offline use; the 7 day re-check
  closes it for any device that does.
- `LicenseKey` also backs the dashboard's license key deliveries
  (`commerce.shippings.licenses`). A key created there with status
  `unassigned` becomes `active` on its first activation.
- After changing a license model run `buddy generate:migrations` and commit the
  snapshot with it.
