# Idle memory benchmark

This suite measures resident memory after a server has handled sustained load
and then sat completely idle. Its default API profile uses 60 seconds of load,
180 seconds of idle, 64 connections, and RSS sampled every 100 milliseconds.

Use the Bun version requested by `package.json`'s `engines.bun` for the baseline.
The runner records that requirement beside the measured runtime and warns when
they differ. To compare another runtime intentionally, invoke its Bun executable
directly; the benchmark servers and the runner use the same executable.

```bash
bun install --cwd bench/routing --frozen-lockfile
BENCH_DEDICATED=1 bun run bench:memory --driver oha --runs 3
```

The default profile compares byte-identical JSON responses at exactly 25,000
requests per second for every target. The lower common rate is intentional:
using the 40,000 and 25,000 tiers from Bun's graphic would expose frameworks to
different allocation pressure and make both peak and settled RSS less directly
comparable.

Next.js SSR and Vite dev are separate workload classes. They are not included
in the API table because comparing an SSR render or development transform with
a static JSON response would be misleading. They need equivalent Stacks SSR
and Stacks dev fixtures before becoming executable profiles.

The runner uses the same byte-for-byte response parity checks as
`bench/routing`. It samples the entire server process tree, so launchers cannot
hide worker memory. The separately launched load generator is not counted. Each
server registers only the selected scenario, so an unrelated validator or
database route cannot inflate one framework's static JSON result. This applies
identically to every target. Repeated runs rotate target order so host drift
cannot consistently favor the same implementation.

Before and after each measurement, the runner refuses to proceed when another
process is using at least 75% of one CPU core. Pass `--allow-busy-host` only for
diagnostic runs; the report records every observed process and remains
non-publishable.

## Reported value

RSS is sampled every 100 milliseconds through both phases. The headline value
is the median of the final 10 seconds of the idle phase. That final window is
less sensitive to one scheduler tick than a single reading at exactly 180
seconds, while still answering the same question. The report also shows peak
RSS during load, load throughput, errors, and the spread across fresh-process
repeats.

On Linux, the sampler reads RSS and descendant relationships directly from
`/proc`; it does not launch `ps` during the load or idle windows. Other hosts
use the portable `ps` fallback and remain direction-only.

Every run writes:

- `report.md`, the human-readable comparison
- `measurements.json`, the compact values and complete run metadata
- `raw/<target>--run<N>.json`, every RSS sample and raw load-generator result

The report and metadata include the Git revision and working-tree state captured
before and after measurement, plus the machine architecture and exact load-generator version. Ignored files are
excluded; source archives without Git are marked unavailable. A revision or
cleanliness change during measurement invalidates publication.

The report declares the requested and delivered rate. A row below 98% rate
attainment is marked invalid and cannot be used for a memory win. Fixed-rate
runs require `oha`; the runner fails instead of silently substituting a
saturating driver.

No baseline is checked in. A publishable baseline requires Bun 1.4.1 from the
Pantry environment, `oha`, at least three fresh-process repeats, a clean Git
revision, and dedicated Linux x64 hardware with no observed competing process.
Set `BENCH_DEDICATED=1` only on such a machine. Other runs list their publication
blockers and are marked direction-only. The weekly GitHub Actions run is a
regression signal and uploads its raw samples, but shared-runner numbers are not
publishable.

Publication also requires every selected target to finish every requested run,
attain at least 98% of its fixed request rate in each run, return zero errors,
and keep the full settled-RSS range within 10% of the median.
The scenario, connection count, load and idle windows, sampling interval,
settled window, target set, and equal fixed rate must match the API profile
described above; altered smoke or diagnostic runs remain direction-only.

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
--allow-busy-host
               run despite another process consuming at least 75% of a core
```

Use `--runs 3` on benchmark hardware when process-to-process spread matters.
Use short `--load` and `--idle` values only to smoke-test the harness, never as
a published memory result.
