---
title: Personal Data and GDPR
description: "Declare personal data on your models, then answer access and erasure requests, enforce retention, and generate the processing register from those declarations."
---
# Personal Data and GDPR

Stacks handles data-subject requests from declarations on your models. You mark
which attributes are personal data and say, per model, whose data the rows are,
what erasure does to them and how long they are kept. Access exports, erasure,
retention pruning and the processing register all read those same declarations,
so the register cannot describe behaviour the application does not have.

Cookie consent is the other half, covered by `<CookieConsent />` and
`useCookieConsent` in `@stacksjs/composables`.

## Declare personal data

Two declarations, both on the model:

- `personal` on an attribute marks the column as personal data. An access export
  includes it, and erasure and retention anonymize it.
- `traits.gdpr` on the model says whose data the rows are, what erasure does, how
  long rows are kept, and why they are held at all.

```ts
// app/Models/Order.ts
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Order',
  table: 'orders',
  belongsTo: ['Customer'],

  traits: {
    gdpr: {
      subject: { via: 'Customer' },
      erasure: 'anonymize',
      basis: 'legal_obligation',
      purpose: 'Order fulfilment, kept for tax and accounting',
      retention: { days: 3650, action: 'anonymize' },
    },
  },

  attributes: {
    deliveryAddress: { personal: true, validation: { rule: schema.string() } },
    totalAmount: { validation: { rule: schema.number() } },
  },
} as const)
```

### `personal`

`personal: true`, or the options form:

| Option | Effect |
|---|---|
| `anonymize` | The value anonymization writes. Defaults to `NULL` for a nullable column, and to a placeholder of the column's type for a `NOT NULL` one: `'[erased]'`, `erased-<id>` when the column is also unique, `0`, `false` or `'{}'`. A `NOT NULL` enum or timestamp has no safe placeholder, so it must say. |
| `export` | `false` leaves the column out of access exports while erasure still clears it. The built-in `User.password` uses this. |

### `traits.gdpr`

| Key | Meaning |
|---|---|
| `subject` | Whose data a row is. Left out, it is derived: `id` on the `User` model, and the foreign key of a `belongsTo: ['User']` everywhere else. |
| `erasure` | `'anonymize'` (the default), `'delete'`, or `'keep'` for records the law requires you to retain. |
| `retention` | `{ days, column?, action? }`. Rows whose `column` (default `created_at`) is older than `days` are deleted (the default) or anonymized. |
| `basis` | The lawful basis: `consent`, `contract`, `legal_obligation`, `vital_interests`, `public_task` or `legitimate_interests`. |
| `purpose` | Why the data is processed, in a sentence. |

`subject` takes one of these forms:

| Form | Matches rows where |
|---|---|
| `'user_id'` or `['referrer_id', 'referred_user_id']` | any named column holds the subject's user id |
| `{ column: 'tokenable_id', where: { tokenable_type: 'users' } }` | the column matches and the fixed values hold, for polymorphic owners |
| `{ via: 'Customer' }` | the `belongsTo` parent row is the subject's. Chains, so `OrderItem` can go via `Order` via `Customer` |
| `{ email: 'recipient' }` | the column holds the subject's email address, for ledgers keyed by address rather than account |

A model with no subject (a request log keyed by IP, say) is out of reach of access
and erasure, but retention still applies to it and the register lists it.

A declaration that cannot be honoured is an error rather than a guess. A personal
`NOT NULL` enum with no `anonymize` value, a `via` naming a model that is not in
`belongsTo`, or a subject with no personal attributes and the default
`'anonymize'` all stop every request until fixed, with each problem named by model.

### Built-in models

The framework's own models ship with declarations: `User`, `Customer`, `Order`,
`Payment`, `Subscriber`, `Comment`, `ConsentEvent`, `SocialAccount`,
`PersonalAccessToken` and the rest of the models that hold personal data. Run
`buddy gdpr:register --stdout` to see all of them. None of them declares a
retention policy, since pruning data an app already holds is a decision for that
app, so override the model in `app/Models/` to add one.

Records the business must keep are anonymized rather than deleted: orders,
payments and transactions keep their amounts and lose the address, card digits
and billing email. Consent records and suppression lists are kept, because
proving consent and honouring an opt-out both need the address.

## Access requests

```bash
buddy gdpr:export ada@example.com --out ada.json   # by email, id or uuid
```

```ts
import { exportSubjectData } from '@stacksjs/orm'

const result = await exportSubjectData(user.id, { actor: 'support' })
// { subject, generatedAt, data: { User: [...], Order: [...] }, processing: { Order: { purpose, basis, retentionDays } } }
```

Each model's rows carry only the declared personal columns plus the row's `id`,
`uuid` and timestamps, so a column added later is not exported until someone
classifies it. Only the subject's rows are included.

Signed-in users can download their own export from `GET /me/data-export`, which
is in the default `auth` route bundle, needs authentication, and is limited to
three requests an hour. The subject is always the caller.

## Erasure

```bash
buddy gdpr:erase ada@example.com --dry-run   # print exactly what would change
buddy gdpr:erase ada@example.com             # asks for confirmation
buddy gdpr:erase 42 --yes                    # non-interactive
```

```ts
import { eraseSubject } from '@stacksjs/orm'

const preview = await eraseSubject(42, { dryRun: true })
const result = await eraseSubject(42, { actor: 'support' })
```

Per model, erasure deletes, anonymizes or keeps the subject's rows as declared,
children before parents and the `User` row last. It runs in one transaction with
its audit row, so an erasure is either complete and recorded or neither. It only
writes rows it has already matched to the subject, a dry run reads the same rows
and writes nothing, and a second run finds nothing left to change.

After the transaction commits, the subject's API tokens are revoked and their
sessions destroyed. Pass `revokeCredentials: false` to skip that.

A table a model declares that this database does not have (a framework default
your app never migrated) is reported as skipped rather than failing the request.

## Retention

```bash
buddy gdpr:prune --dry-run
buddy gdpr:prune
```

`PruneRetainedDataJob` runs the same thing daily at 03:30. Ages are compared as
dates, so a policy of 30 days removes rows older than exactly 30 days whichever
timestamp format the column holds. Each run that changes something writes one
audit row.

## The audit ledger

Every access export, every erasure, and every retention run that changed rows
writes a row to `gdpr_requests` (the `GdprRequest` model): the type, the subject
id, who asked, and per-model counts. It holds no personal values, and it has no
foreign key to `users`, because the record of erasing someone has to outlive
their row. Run `buddy migrate` to create it.

## The processing register

```bash
buddy gdpr:register                 # writes database/processing-register.md
buddy gdpr:register --format json   # database/processing-register.json
buddy gdpr:register --stdout
buddy gdpr:register:check           # fails when the committed copy is stale
```

The register lists every model that declares personal data or a `gdpr` trait:
its table, subject link, personal columns, erasure behaviour, retention, lawful
basis and purpose. It is byte-stable, with no timestamp and everything sorted,
so you can commit it and run `gdpr:register:check` in CI.

It also lists models that belong to a user but declare nothing, under
**Unclassified**. Access and erasure do not reach those models, so classify each
one, even if only as `erasure: 'keep'`.
