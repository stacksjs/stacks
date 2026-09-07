# Routing benchmark

What it costs Stacks to answer a request, next to Elysia, Hono, and the ceiling
of the runtime all three sit on.

```bash
bun bench/routing/run.ts
```

That runs every scenario against the default targets the machine can boot and writes a
timestamped directory under `results/` containing `report.md`,
`measurements.json`, and the raw load-generator output for every individual run.
The JSON artifact embeds the selected target definitions and complete scenario
contracts, including request bodies, expected responses, headers profiles, and
validation probes.

Reports and metadata record the Git revision and working-tree state both before
and after measurement, plus the machine architecture. Ignored files are
excluded from that state; source archives without Git are marked unavailable.
A revision or cleanliness change during measurement invalidates publication.
Reports also record the versions resolved for every selected peer framework in
that same isolated server context, so a copied result remains tied to the code
that actually ran.

## Why the harness looks like this

A throughput number is easy to produce and easy to produce dishonestly by
accident. The safeguards here exist only to stop that:

- **Response parity is asserted before and after every measurement.** Every target has
  to answer every scenario with status 200, an application/json media type, and
  byte-identical bodies (`scenarios.ts` holds the expected string). A server that
  is fast because it returns a different result is not a faster server, and this
  checks are what catch it, including behavior that drifts after sustained load.
- **Validation is probed, not assumed.** Before `post-validate` is measured,
  every target must reject missing fields and wrong field types with a client
  error, then accept an extra input field without echoing it. These setup-only
  probes keep a no-op or permissive handler out of the comparison.
- **Parity evidence is retained.** `measurements.json` records the exact status,
  media type, body byte count, and SHA-256 body digest before and after each
  timed run for the primary request and every validation probe. A target whose
  fingerprint changes under load aborts the run.
- **Stacks runs the real framework source.** A subprocess using the same Bun
  executable, working directory, and isolated config as every benchmark server
  resolves each public `@stacksjs/*` package entry point. The runner requires
  every result to live under that package's `storage/framework/core/*/src` tree
  and records every resolved path. The Stacks fixture may configure and call public
  APIs, but may not import framework internals or reimplement a data path with
  `bun:sqlite`. Tests also reject benchmark selectors in framework source and
  prevent the fixture from bypassing the router with direct Bun serving,
  prebuilt responses, or manual JSON serialization.
- **Every process exposes only benchmark routes.** The Stacks fixture uses the
  framework's public programmatic-router configuration to disable application
  route discovery, and its public API-server configuration to disable view
  discovery. Without both, this repository's `routes/` modules and application
  views would load during `serve()` even though every peer process contains
  only the selected scenario. The fixture does not touch bun-router internals
  or point discovery at a benchmark-owned empty directory.
- **Warm-up is discarded, not measured.** 5 seconds by default, then 30 measured.
- **Busy hosts are rejected around every measurement.** One competing process,
  or combined competing work, using at least 75% of one core before a server
  starts or after it stops aborts
  the run. `--allow-busy-host` is an explicit direction-only override, recorded
  in the report.
- **Three runs, median reported, spread printed beside it.** A single run on a
  laptop is a mood, not a measurement. If the `spread` column is wide, the
  median is not telling you much. A full range above 10% of the median marks
  that scenario unstable and invalid for comparison.
- **Every measurement gets a fresh server process.** Target order follows a
  balanced triplet plus complementary pairs, so every target's cumulative
  position is equal, or differs by the mathematically unavoidable single
  position for an odd number of runs over an even-sized matrix. Route warm state
  and a warming or throttling host therefore cannot consistently favor one
  implementation.
- **Comparisons are paired within each scheduled run.** When Bun raw is selected,
  the `Bun raw` column reports the median target-to-raw ratio and its range.
  This exposes host drift that separate target medians can conceal.
- **CPU is reported per row.** Deltas of the server's cumulative CPU time over
  the wall clock of the measured load invocation, after warm-up has finished.
  This includes load-tool startup and shutdown overhead. A win bought by burning more CPU is visible here
  rather than hidden inside "req/s".

## Load generators

| Driver | Publishable | Notes |
|---|---|---|
| `oha` | yes | Preferred. `brew install oha` or `cargo install oha`. |
| `bombardier` | **no** | Native direction-only fallback. It reports status classes, not exact codes. |
| `autocannon` | **no** | JS fallback for direction-only comparisons. |
| `builtin` | **no** | Ships with the harness so a clean checkout can run. |

The runner picks the first available in that order, or takes `--driver <name>`.

The JavaScript drivers can become the limit before the server does. The built-in
driver is Bun subprocesses driving `fetch`, so it also competes with the server
under test for the same cores and runtime. They are genuinely useful for "did
that change help", which is what they are kept for. Every report they produce
is stamped `direction-only`, and numbers from them must not leave this
directory. Install `oha` before producing anything anyone else will read.

## The machine matters

Anything published needs a documented machine and load tool: CPU model, core
count, OS, Bun version, exact generator version, and load topology. The report
records all of them automatically. A laptop throttles and a shared cloud VM has
neighbours; neither produces a number worth quoting.

This runner launches the generator on the same host as the target and labels
that topology in every report. Rotated target order keeps the comparison
symmetric, but generator and server still share CPU caches and memory
bandwidth, so absolute throughput may be understated. A separate generator
host is preferable for a saturation study, but requires external orchestration
and must not be presented as output from this single-host runner.

Set `BENCH_DEDICATED=1` only on that dedicated server. The runner additionally
requires a clean identified revision, the configured Bun runtime, at least 5
seconds of warm-up, 30 measured seconds, three repeats, and no observed busy
process. Publication also requires every default target and every declared
scenario, preventing a minimal-only profile or easy-scenario subset from being
presented as the benchmark. Explicit tuned targets may be added, but cannot
replace the stock matrix. Reports list every unmet publication prerequisite.

Publication additionally requires every selected target and scenario to finish
all repeats, return valid measurements without request errors, include a server
CPU reading, retain a complete and stable parity fingerprint for every repeat,
and stay within the 10% throughput stability range.

Use the Bun version requested by `package.json`'s `engines.bun` for the baseline.
The runner records that requirement beside the actual runtime version and warns
when they differ. Alternate runtimes are allowed for explicit runtime comparisons:
invoke the desired Bun binary directly, for example `/path/to/bun bench/routing/run.ts`.
The benchmark servers use the same executable as the runner.

Every server here is a single Bun listener with no `reusePort` clustering, so
the comparison is per-core across the board. A multi-core run is a separate,
clearly-labelled exercise.

## Scenarios

| id | What it measures |
|---|---|
| `static-json` | The floor: one static JSON literal, no params, no middleware, no DB. Bun raw uses a native static response. |
| `path-param` | One path param, echoed. |
| `post-validate` | A JSON body through each framework's schema validation. |
| `db-roundtrip` | A SQLite read, through each framework's idiomatic data path. |

`db-roundtrip` builds its own fixture in `.tmp/bench.sqlite` and never touches
`database/stacks.sqlite`. Stacks reads it through its own query builder (the
runner points `DB_DATABASE_PATH` at the fixture); the others open it with
`bun:sqlite` directly, because none of them ships an ORM and that is their
idiomatic path. That asymmetry favours them, and it is stated here rather than
papered over. The Stacks route builds its invariant typed query once at startup,
matching the prepared statements used by the direct `bun:sqlite` targets, then
uses the SQLite-only `executeSync()` terminal because Bun SQLite performs the
read synchronously either way. This avoids adding Promise scheduling that the
other targets do not have. `post-validate` has the same shape: Elysia uses its `t` schema,
Hono a hand-written check behind its own `validator()` seam, and both are
cheaper than a compiled rule set.

The Bun raw ceiling uses `Bun.serve`'s native route table, matching the native
dispatch used by Stacks in production. Its static scenario is a prebuilt
`Response`; dynamic routes construct only the response their payload requires.
Keeping synchronous routes out of an `async fetch` wrapper avoids charging the
runtime baseline for Promise scheduling it does not need.

The fixture includes `query_logs` and its indexes, but persistent query history
is disabled by default in production. This keeps the stock database scenario
focused on the request and read path shared by every target. It also lets the
query builder use its direct no-hooks execution path. Development keeps
request-scoped query tracking for Stacks error diagnostics.

Set `DB_QUERY_LOGGING_ENABLED=true` to include durable query history in the
workload. The bare SQLite targets do not provide an equivalent logger, so treat
that run as an observability-cost profile rather than a like-for-like database
comparison. Accumulated logs are cleared before each repetition, outside
warm-up and measurement, while the seeded read data stays unchanged.

A former process-wide recursion guard could also skip legitimate queries while a
log write was pending. Logging now suppresses only queries descended from its
own write, with warm sequential and concurrent persistence checks. Database
results from before that correction should be rerun because they may include
less logging work.

When persistent logging is explicitly enabled, the parity probe clears old logs
and waits for a successful log of its benchmark SELECT. Failing query logging
then aborts the run instead of producing a faster, incomplete workload. This
check runs outside warm-up and measurement.

With `oha` or `builtin` and persistent logging enabled, each Stacks database
load run also verifies that the successful persisted SELECT count matches the
total warmup and measured request count. A count mismatch, request errors, or
an empty measured load aborts the run. Counting happens after CPU sampling,
outside the timed window. Raw warmup output and a `--persistence.json` sidecar
record the request counts used by this check.

Other drivers do not guarantee that their response counts include every in-flight
request at the deadline. Their sidecars explicitly mark aggregate persistence
verification as unavailable; the pre-load parity check still applies.

## Profiles

Stacks has three default profiles. The gap between the first and the third
row is the price of what Stacks does by default and the others do not do at all,
and reading it as anything else is the mistake this table exists to prevent.

| Target | What it is |
|---|---|
| `stacks` | Stock defaults, and a client that never sends a cookie back. Every GET mints a fresh CSRF render token, which is a real cost for a real first visit. |
| `stacks-warm` | Stock defaults, client echoes the CSRF cookie — a browser or SPA from its second request onward. |
| `stacks-minimal` | `STACKS_SECURITY_HEADERS_DISABLE=true`, `csrf: false` for token-only APIs, and `requestIds: false` for deployments whose proxy owns correlation. GET requests carry the same headers as peer targets. Everything else unchanged. |

**`stacks-minimal` is not a headline number.** It exists to price the
safe-by-default work separately from the framework's own overhead. Publishing it
as "Stacks' speed" next to a bare Elysia app would compare a server that sets
security headers and defends against CSRF with one that does neither. If a
comparison ever quotes a Stacks-vs-Elysia figure, it either gives Elysia
equivalent guarantees or it says plainly which profile produced the number.

The opt-in `stacks-wal-full` target measures a configured SQLite deployment:
1000-page WAL checkpoints and `synchronous=FULL`, with the same security,
validation, query-tracking, and cookie behavior as `stacks-warm`. It verifies
both SQLite settings before listening. Run it explicitly:

```bash
bun bench/routing/run.ts --targets stacks-warm,stacks-wal-full --scenarios db-roundtrip --driver oha
```

Reports label this target as tuned. It is excluded from the default target
list, and its database results must not be presented as stock Stacks defaults.
See the [SQLite configuration guide](../../docs/packages/query-builder.md#sqlite-write-throughput)
for the checkpoint and backup implications. The memory runner also accepts
this target with an explicit `--rate`.

The runner resets its profile selectors and security-header switch before
applying each target's settings, so shell variables from a previous run cannot
silently turn a stock target into a tuned or minimal one.
It also fixes the database driver to SQLite, matching the isolated fixture.

## Peer targets

Elysia, Express, Fastify, and Hono are exact dependencies of the isolated
benchmark package. Install its locked dependency set with
`bun install --cwd bench/routing --frozen-lockfile`. If a dependency is absent,
the runner records that target as skipped and the report says so rather than
reporting a zero.

## Flags

```
--targets      comma-separated target ids
--scenarios    comma-separated scenario ids
--driver       oha | bombardier | autocannon | builtin
--connections  concurrent connections (default 50)
--warmup       seconds discarded before measuring (default 5)
--duration     seconds measured (default 30)
--runs         repeats per scenario, median reported (default 3)
--no-db        skip the SQLite fixture and the db-roundtrip scenario
--allow-busy-host
               run despite competing processes using 75% of a core
--output       explicit output directory (default results/<timestamp>)
```

## Recorded numbers

**There is no recorded baseline yet.** No run has been made on a machine that
meets the bar above, so this directory deliberately contains no results, and
nothing in the marketing copy quotes a routing throughput figure.

Direction-only figures from the optimization work are in the git log, on the
commits that produced them - `git log --grep="perf(router)"`. They were taken
with the built-in generator on a developer laptop, they are labelled as such in
every message, and they exist to say "that change helped", not "this is how fast
Stacks is".

To record a real baseline:

1. Get a dedicated or reserved instance for the runner and target server.
2. Install `oha` there (`brew install oha` / `cargo install oha`).
3. Run `bun install --cwd bench/routing --frozen-lockfile` so every pinned peer
   framework is present.
4. `bun bench/routing/run.ts` with the defaults (5s warm-up, 30s measured, 3 runs).
5. Commit the whole `results/<timestamp>/` directory - report, measurements, and
   the raw per-run output. The spread column is the honesty check: if it is
   wide, the run is noise and the median means nothing.

For a remote-generator study, orchestrate the two hosts outside this runner and
label the resulting topology separately. Do not present it as this runner's
same-host output.

Only then does any public-facing comparison get to quote a number, and only with
the profile it came from named beside it.

## Regression watching

Once a baseline exists on known hardware, re-run `static-json` on a schedule and
alert when throughput drops more than ~15% against it. Scheduled and
non-blocking, not a per-PR gate: shared runners vary enough that a hard gate
would fail merges for reasons that have nothing to do with the change, and a
flaky gate stops being read long before it catches anything real.
