# Referrals

Stacks provides native referral codes, first-attribution signup tracking, and
idempotent qualification in `@stacksjs/auth` (or `stacks/auth`). Generate and apply
model migrations before enabling referral links:

```sh
./buddy generate:migrations
./buddy migrate
```

The auth route bundle exposes `GET /api/referrals` and `POST /api/referrals/code`.
Both require authentication and derive ownership from the signed-in account.
The summary returns only a code and aggregate registered/qualified counts.
Referral records have no generated CRUD API.

```ts
import { createReferralCode, register, qualifyReferral } from '@stacksjs/auth'

const code = await createReferralCode(user.id)
const url = `${appUrl}/signup?ref=${code}`
await register({ name, email, password, referralCode: code })

// Call from a trusted event, such as verified onboarding or a paid subscription.
await qualifyReferral(newUser.id)
```

Password registration accepts the optional `referralCode` input. Custom social
registration can call `attributeReferral(newUserId, code, transaction)` inside
its new-user transaction. Preserve the code across the OAuth redirect in a
secure cookie bound to that flow. Never attribute returning users or expose
qualification as a client-controlled endpoint.

Codes use 96 bits of cryptographic randomness. One code belongs to each user;
one attribution belongs to each referred user. Database uniqueness resolves
concurrent attempts. Invalid codes, self-referrals, and repeat attribution are
ignored, while database failures propagate. Qualification preserves its first
timestamp. Apps decide what qualifies; no financial reward is issued automatically.
