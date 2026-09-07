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
It reports Stacks twice: stock defaults with a returning client's CSRF cookie,
and the explicitly labeled minimal API profile with CSRF, framework security
headers, and framework-owned request IDs disabled. The stock row shows what
users receive by default. The minimal row is the capability-equivalent
comparison with peers that do not enable those features in their fixtures.

Next.js SSR and Vite dev are separate workload classes. They are not included
in the API table because comparing an SSR render or development transform with
a static JSON response would be misleading. They need equivalent Stacks SSR
and Stacks dev fixtures before becoming executable profiles.

The runner uses the same byte-for-byte response parity checks as
`bench/routing`, both before load and after the idle period. The JSON artifact
retains status, media type, body byte count, and SHA-256 body digest evidence
for the primary request and every validation probe. Any change across load and
idle aborts the run. It samples the entire server process tree, so launchers
cannot hide worker memory. The separately launched load generator is not counted. Each
server registers only the selected scenario, so an unrelated validator or
database route cannot inflate one framework's static JSON result. This applies
identically to every target. Repeated runs rotate target order so host drift
cannot consistently favor the same implementation. The balanced triplet plus
complementary pairs give every target the same cumulative position in the
seven-target matrix instead of moving each target only one place per repeat
across the hour-long suite.
The load generator runs on the same host as the target server for every row.
This symmetric topology can understate absolute throughput when the generator
and server compete for CPU, so the report records it explicitly. A remote load
study requires external orchestration and must not be presented as runner output.
The same source-provenance preflight uses the benchmark server's Bun executable,
working directory, and isolated config. It requires every Stacks package used
by the fixture to resolve from its framework source tree through a public
package entry point, and records those paths in the report.
The Stacks fixture also disables file-based view discovery through the public
router API, so the repository's application pages do not enter a one-route API
memory comparison.

Before and after each measurement, the runner refuses to proceed when one
process or combined competing work is using at least 75% of one CPU core.
Pass `--allow-busy-host` only for
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
- `measurements.json`, the compact values, complete run metadata, selected
  target definitions, and scenario contract
- `raw/<target>--run<N>.json`, every RSS sample and raw load-generator result

The report and metadata include the Git revision and working-tree state captured
before and after measurement, plus the machine architecture, exact load-generator
version, load topology, and exact versions resolved for selected peer frameworks.
Ignored files are excluded; source archives without Git are marked unavailable.
A revision or cleanliness change during measurement invalidates publication.

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
               run despite competing processes consuming 75% of a core
```

Use `--runs 3` on benchmark hardware when process-to-process spread matters.
Use short `--load` and `--idle` values only to smoke-test the harness, never as
a published memory result.
