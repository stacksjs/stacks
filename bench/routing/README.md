# Routing benchmark

What it costs Stacks to answer a request, next to Elysia, Hono, and the ceiling
of the runtime all three sit on.

```bash
bun bench/routing/run.ts
```

That runs every scenario against every target the machine can boot and writes a
timestamped directory under `results/` containing `report.md`,
`measurements.json`, and the raw load-generator output for every individual run.

## Why the harness looks like this

A throughput number is easy to produce and easy to produce dishonestly by
accident. Four things in here exist only to stop that:

- **Response parity is asserted before anything is measured.** Every target has
  to answer every scenario with byte-identical bodies (`scenarios.ts` holds the
  expected string). A server that is fast because it 404s, 422s, or returns less
  is not a faster server, and this check is what catches it.
- **Warm-up is discarded, not measured.** 5 seconds by default, then 30 measured.
- **Three runs, median reported, spread printed beside it.** A single run on a
  laptop is a mood, not a measurement. If the `spread` column is wide, the
  median is not telling you much.
- **CPU is reported per row.** Deltas of the server's cumulative CPU time over
  the wall clock of the run. A win bought by burning more CPU is visible here
  rather than hidden inside "req/s".

## Load generators

| Driver | Publishable | Notes |
|---|---|---|
| `oha` | yes | Preferred. `brew install oha` or `cargo install oha`. |
| `bombardier` | yes | `brew install bombardier`. |
| `autocannon` | yes | JS-native fallback. |
| `builtin` | **no** | Ships with the harness so a clean checkout can run. |

The runner picks the first available in that order, or takes `--driver <name>`.

The built-in driver is Bun subprocesses driving `fetch`, and it competes with
the server under test for the same cores and the same runtime — under it, no
target here saturates a core, which means the *generator* is the limit and every
row understates every server. It is genuinely useful for "did that change help",
which is what it was written for. Every report it produces is stamped
`direction-only`, and numbers from it must not leave this directory. Install
`oha` before producing anything anyone else will read.

## The machine matters

Anything published needs a documented machine: CPU model, core count, OS, and
Bun version, all of which the report records automatically. A laptop throttles
and a shared cloud VM has neighbours; neither produces a number worth quoting.
Use a dedicated or reserved instance, and run the load generator on a different
machine from the server — a generator competing for the server's cores
understates the server, every time.

Every server here is a single Bun listener with no `reusePort` clustering, so
the comparison is per-core across the board. A multi-core run is a separate,
clearly-labelled exercise.

## Scenarios

| id | What it measures |
|---|---|
| `static-json` | The floor: one static JSON literal, no params, no middleware, no DB. |
| `path-param` | One path param, echoed. |
| `post-validate` | A JSON body through each framework's schema validation. |
| `db-roundtrip` | A SQLite read, through each framework's idiomatic data path. |

`db-roundtrip` builds its own fixture in `.tmp/bench.sqlite` and never touches
`database/stacks.sqlite`. Stacks reads it through its own query builder (the
runner points `DB_DATABASE_PATH` at the fixture); the others open it with
`bun:sqlite` directly, because none of them ships an ORM and that is their
idiomatic path. That asymmetry favours them, and it is stated here rather than
papered over. `post-validate` has the same shape: Elysia uses its `t` schema,
Hono a hand-written check behind its own `validator()` seam, and both are
cheaper than a compiled rule set.

## Profiles

Stacks appears three times on purpose. The gap between the first and the third
row is the price of what Stacks does by default and the others do not do at all,
and reading it as anything else is the mistake this table exists to prevent.

| Target | What it is |
|---|---|
| `stacks` | Stock defaults, and a client that never sends a cookie back. Every GET mints a fresh CSRF render token, which is a real cost for a real first visit. |
| `stacks-warm` | Stock defaults, client echoes the CSRF cookie — a browser or SPA from its second request onward. |
| `stacks-minimal` | `STACKS_SECURITY_HEADERS_DISABLE=true` and `.skipCsrf()` on the mutating route. Everything else unchanged. |

**`stacks-minimal` is not a headline number.** It exists to price the
safe-by-default work separately from the framework's own overhead. Publishing it
as "Stacks' speed" next to a bare Elysia app would compare a server that sets
security headers and defends against CSRF with one that does neither. If a
comparison ever quotes a Stacks-vs-Elysia figure, it either gives Elysia
equivalent guarantees or it says plainly which profile produced the number.

## Optional targets

Elysia and Hono are not dependencies of this repo. Install them where Bun will
resolve them (`bun add -d elysia hono`) and they join the run; without them the
runner records them as skipped and the report says so, rather than reporting a
zero.

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

1. Get a dedicated or reserved instance, and a second machine for the generator.
2. Install `oha` there (`brew install oha` / `cargo install oha`).
3. `bun add -d elysia hono` so the comparison targets are not skipped.
4. `bun bench/routing/run.ts` with the defaults (5s warm-up, 30s measured, 3 runs).
5. Commit the whole `results/<timestamp>/` directory - report, measurements, and
   the raw per-run output. The spread column is the honesty check: if it is
   wide, the run is noise and the median means nothing.

Only then does any public-facing comparison get to quote a number, and only with
the profile it came from named beside it.

## Regression watching

Once a baseline exists on known hardware, re-run `static-json` on a schedule and
alert when throughput drops more than ~15% against it. Scheduled and
non-blocking, not a per-PR gate: shared runners vary enough that a hard gate
would fail merges for reasons that have nothing to do with the change, and a
flaky gate stops being read long before it catches anything real.
