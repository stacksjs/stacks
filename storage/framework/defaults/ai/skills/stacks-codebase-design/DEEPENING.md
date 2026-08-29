# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies.
Assumes the vocabulary in [SKILL.md](SKILL.md): **module**, **interface**,
**seam**, **adapter**.

## Dependency categories

When assessing a candidate for deepening, classify its dependencies. The
category decides how the deepened module is tested across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O. In Stacks: `@stacksjs/strings`,
`@stacksjs/arrays`, `@stacksjs/collections`, `@stacksjs/datetime`, validation
rules, most of what lives in `resources/functions/`. Always deepenable. Merge the
modules and test through the new interface directly. No adapter needed.

### 2. Local-substitutable

Dependencies with a local test stand-in. In Stacks this is the common case and
the framework already provides the stand-ins:

- The database. `setupDatabase()` / `refreshDatabase()` from `@stacksjs/testing`
  give you a real SQLite instance at `database/stacks_testing.sqlite`.
- The cache. The `memory` driver stands in for `redis`.
- The queue. `fake()` / `restore()` from `@stacksjs/queue` stand in for a real
  worker.
- Storage. The local driver stands in for S3.

Deepenable whenever the stand-in exists. The deepened module is tested with the
stand-in running in the suite. The seam is internal, and no port appears at the
module's external interface.

### 3. Remote but owned (ports and adapters)

Your own services across a network boundary. In Stacks this is the API server
and its typed client, a Lambda in serverless mode, or a second tenant on the same
box. Define a **port** at the seam. The deep module owns the logic, the transport
is injected as an **adapter**. Tests use an in-memory adapter, production uses
the HTTP one.

Recommendation shape: *"Define a port at the seam, implement an HTTP adapter for
production and an in-memory adapter for testing, so the logic sits in one deep
module even though it is deployed across a network."*

### 4. True external (mock)

Third-party services you do not control: Stripe, SES, Twilio, Meilisearch,
Algolia, Anthropic, OpenAI, Route53, Hetzner. The deepened module takes the
external dependency as an injected port, and tests provide a mock adapter. This
is what the driver packages already do: `BaseChatDriver`, the email drivers, the
AI drivers. When you add a fifth external service, add a driver rather than a
call site.

## Seam discipline

- **One adapter means a hypothetical seam. Two adapters means a real one.** Do
  not introduce a port unless at least two adapters are justified, typically
  production plus test. A single-adapter seam is just indirection.
- **Internal seams versus external seams.** A deep module can have internal
  seams, private to its implementation and used by its own tests, as well as the
  external seam at its interface. Do not expose internal seams through the
  interface just because tests use them.
- **Do not put a seam where the framework already gives you one.** The `app/`
  override model, the driver config in `config/*.ts`, and the model traits are
  existing seams. A hand-rolled indirection beside one of them is a second way to
  do the same thing.

## Testing strategy: replace, do not layer

- Old unit tests on the shallow modules become waste once tests at the deepened
  module's interface exist. Delete them.
- Write the new tests at the deepened module's interface. The **interface is the
  test surface**.
- Assert on observable outcomes through the interface, not internal state.
- Tests should survive internal refactors because they describe behaviour. If a
  test has to change when the implementation changes, it is testing past the
  interface.
