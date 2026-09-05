# Idle memory benchmark

This suite measures resident memory after a server has handled sustained load
and then sat completely idle. Its default API profile follows the Bun 1.4.1
comparison method: 60 seconds of load, 180 seconds of idle, 64 connections,
and RSS sampled every 100 milliseconds.

```bash
bun install --cwd bench/routing --frozen-lockfile
BENCH_DEDICATED=1 bun run bench:memory --driver oha --runs 3
```

The default profile compares byte-identical JSON responses at the fixed rates
shown in the Bun graphic. Stacks, Elysia, Hono, and the raw Bun baseline receive
40,000 requests per second. Express and Fastify receive 25,000. Stacks is held
to the higher tier rather than being assigned an easier rate.

Next.js SSR and Vite dev are separate workload classes. They are not included
in the API table because comparing an SSR render or development transform with
a static JSON response would be misleading. They need equivalent Stacks SSR
and Stacks dev fixtures before becoming executable profiles.

The runner uses the same byte-for-byte response parity checks as
`bench/routing`. It samples the entire server process tree, so launchers cannot
hide worker memory. The separately launched load generator is not counted. Each
server registers only the selected scenario, so an unrelated validator or
database route cannot inflate one framework's static JSON result. This applies
identically to every target.

## Reported value

RSS is sampled every 100 milliseconds through both phases. The headline value
is the median of the final 10 seconds of the idle phase. That final window is
less sensitive to one scheduler tick than a single reading at exactly 180
seconds, while still answering the same question. The report also shows peak
RSS during load, load throughput, errors, and the spread across fresh-process
repeats.

Every run writes:

- `report.md`, the human-readable comparison
- `measurements.json`, the compact values and complete run metadata
- `raw/<target>--run<N>.json`, every RSS sample and raw load-generator result

The report and metadata include the Git revision and working-tree state captured
before output creation. Ignored files are excluded; source archives without Git
are marked unavailable. Keep source unchanged throughout the run.

The report declares the requested and delivered rate. A row below 98% rate
attainment is marked invalid and cannot be used for a memory win. Fixed-rate
runs require `oha`; the runner fails instead of silently substituting a
saturating driver.

No baseline is checked in. A publishable baseline requires Bun 1.4.1 from the
Pantry environment, `oha`, and dedicated Linux x64 hardware. Set
`BENCH_DEDICATED=1` only on such a machine. Other runs are marked
direction-only. The weekly GitHub Actions run is a regression signal and
uploads its raw samples, but shared-runner numbers are not publishable.

## Flags

```text
--targets      comma-separated target ids
--scenario     routing scenario to load (default static-json)
--driver       oha | bombardier | autocannon | builtin
--connections  concurrent connections (default 64)
--rate         override every target's declared fixed request rate
--load         sustained-load seconds (default 60)
--idle         quiet seconds after load (default 180)
--interval     RSS sample interval in milliseconds (default 100)
--settle       final idle window used for the median (default 10)
--runs         fresh-process repeats per target (default 1)
--output       explicit output directory
```

Use `--runs 3` on benchmark hardware when process-to-process spread matters.
Use short `--load` and `--idle` values only to smoke-test the harness, never as
a published memory result.
