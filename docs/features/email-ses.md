# Sending email via AWS SES

This page is the practical checklist for routing outgoing mail through AWS SES from a Stacks app. The companion [Email Server](./email.md) page covers the EC2-based mail-os receive surface; the two layers are independent and most setups end up using both (mail-os for `MX`/inbox, SES for outbound).

## TL;DR

```bash
# .env
MAIL_MAILER=ses
MAIL_FROM_NAME="Your App"
MAIL_FROM_ADDRESS=hello@yourdomain.com
AWS_SES_REGION=eu-central-1       # the region where your identity is verified
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
```

No code change needed. The `ses` driver registers automatically via `storage/framework/core/email/src/email.ts` and gets picked when `MAIL_MAILER=ses` (or `MAIL_DRIVER=ses`).

## Region selection

SES identities (domains + email addresses) live in a specific AWS region. `AWS_SES_REGION` MUST match the region where the From identity is verified — a mismatch yields an `endpoint unreachable` style error rather than a verification one. Common picks:

- `us-east-1` — broadest feature support, default
- `eu-central-1` — closest for EU customers
- `eu-west-1` — also fine for EU; check whether your data-residency story prefers Frankfurt or Dublin

You can verify the same domain in multiple regions for redundancy, but the driver only talks to one region per process.

## Verify a sender identity

1. Open the SES console and go to **Verified identities › Create identity**.
2. Pick **Domain** (recommended) and enter `yourdomain.com`.
3. Toggle **Easy DKIM** on, and enable "Publish DNS records to Route 53" if your DNS is on Route 53; otherwise SES gives you three CNAME records to paste into your provider.
4. Wait for status to flip to **Verified** (usually <15 min; up to 72h depending on DNS TTL).

For testing without a domain, you can also verify a single email address — but DKIM only works at the domain level, so prod should always use a domain identity.

## DNS records you actually need

For a domain identity at `example.com`, with SES sending mail visibly from that domain:

| Type | Name | Value | Notes |
|---|---|---|---|
| CNAME × 3 | `<token>._domainkey.example.com` | SES-provided values | DKIM signing — pasted from the SES console |
| TXT | `example.com` | `v=spf1 include:amazonses.com ~all` | SPF — adjust if you also send via your own MTA / mail-os |
| TXT | `_dmarc.example.com` | `v=DMARC1; p=none; rua=mailto:dmarc@example.com` | DMARC — start at `p=none` for monitoring; tighten to `quarantine`/`reject` after a few weeks of clean reports |
| MX | `feedback-smtp.<region>.amazonses.com` | `10 feedback-smtp.<region>.amazonses.com` | Only needed if you set a Custom MAIL FROM domain |

If you also run the EC2 mail-os receive surface, keep your existing `MX` pointing at the mail-os host — SES sending and mail-os receiving don't conflict.

## Sandbox vs production

Every new SES account starts in **sandbox** mode:

- You can only send to verified addresses
- 200 emails/day, 1 email/second cap
- The driver will surface "SES sandbox restriction" in the error message when a send hits this

To request production access, open the SES console and go to **Get set up › Request production access**. Fill in:

- Use case (transactional vs marketing — be honest, both are fine)
- Website URL
- How you handle bounces and complaints
- How recipients opt in

Approval typically takes <24h.

## IAM permissions

Minimum IAM policy for the IAM user / role that the driver authenticates as:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
```

If you want to scope to a specific identity:

```json
{
  "Effect": "Allow",
  "Action": "ses:SendEmail",
  "Resource": "arn:aws:ses:eu-central-1:<account-id>:identity/example.com",
  "Condition": {
    "StringEquals": {
      "ses:FromAddress": "hello@example.com"
    }
  }
}
```

## Credentials precedence

The driver pulls credentials in this order:

1. **`config.services.ses.credentials`** if both `accessKeyId` and `secretAccessKey` are non-empty. Use this when you want a dedicated SES IAM user separate from the global AWS keys.
2. **`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars.** Default for most setups.
3. **`~/.aws/credentials` file** (honors `AWS_PROFILE`).
4. **Empty credentials** → SES will 403 immediately.

> **EC2/ECS/Lambda IAM roles** (instance metadata / task role) are not yet supported by the underlying `AWSClient`. Until that lands, run with explicit env-var credentials on those platforms.

## Local dev, no real sends

```bash
MAIL_MAILER=log
```

The `log` driver writes every send to the logger. Use `smtp` against [Mailpit](https://mailpit.axllent.org/) / [HELO](https://usehelo.com/) when you want to inspect rendered HTML:

```bash
MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
```

## Bounces & complaints

SES will throttle and eventually pause your account if your bounce rate exceeds 5% or complaint rate exceeds 0.1%. Production deployments should:

1. Create an SNS topic per event type (bounce, complaint, delivery).
2. Attach the topic in **Verified identities → your domain → Notifications**.
3. Subscribe a Lambda (or HTTPS endpoint) that flips a `suppressed` flag on the recipient in your DB and skips future sends.

> The Stacks email driver doesn't ship a bounce-handler endpoint yet. Track this on the [stacks issue tracker](https://github.com/stacksjs/stacks/issues) if you need it — the driver's send path supports it via SES configuration sets (not yet exposed in the driver API).

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `Email address is not verified` | Sandbox mode, or recipient/sender not verified | Verify identity in SES console, or request production access |
| `Signature does not match` / `InvalidClientTokenId` | Bad / missing AWS credentials | Check `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`; confirm IAM policy includes `ses:SendEmail` |
| `Could not be reached` / `ENOTFOUND` | Region mismatch | `AWS_SES_REGION` must equal the region where the identity is verified |
| `Daily message quota exceeded` | Sandbox 200/day or production sending cap | Request a sending quota increase |
| All recipients in `BccAddresses` are `null` | Display-name commas | The driver quote-wraps display names automatically; if you see this with custom send code, RFC 5322-quote the name yourself |

## What's NOT in the driver today

These are intentional gaps you might hit:

- **Attachments** — the driver uses SES `Content.Simple`, not `Raw` MIME. Track as a follow-up if you need it.
- **`ReplyTo`** — the `message.replyTo` field is dropped on the floor by the SES driver currently.
- **`ConfigurationSetName`** — needed for per-message SNS event routing.
- **`EmailTags`** — useful for tagging by tenant / campaign in SES analytics.
- **IAM-role / IMDSv2 credentials** — env-var or `~/.aws/credentials` only.

File issues against `stacksjs/stacks` if any of those block your deployment.
