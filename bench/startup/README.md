# Fresh-process router import benchmark

This diagnostic compares the built `@stacksjs/router` package root with its
narrow `runtime` entry. Build the package through its ordinary production build
before running the comparison. The runner requires the Bun version configured
in the repository's `package.json`:

```bash
(cd storage/framework/core/router && bun run build)
bun run bench:startup -- --pairs=30
```

Every measurement starts a new Bun process, imports one entry, verifies the same
serving symbols, forces garbage collection, and records import time plus settled
RSS. Order alternates within each pair. The JSON result retains every sample,
paired ratios, medians, sign counts, the reachable local JavaScript graph, Bun
and machine details, exact dependency versions, and source fingerprints from
before and after the run.

Fresh processes use the benchmark's intentionally empty Bun configuration. This
prevents application preloads from importing framework code before the timer.
They also disable automatic env-file loading and inherit only the host variables
needed to run Bun, so application settings cannot change one measurement host's
import graph or memory.

The runner rejects missing build output, unresolved local imports, malformed
child output, incomplete pairs, and source or build changes during measurement.
External package files are represented by dependency provenance instead of
being counted in the local router build graph.

Developer machines and hosted runners provide diagnostic evidence. Do not use
these results as public rankings without a separately documented dedicated-host
publication profile.

## Database runtime import diagnostic

The same alternating fresh-process method compares the built database tooling
barrel with the request-time database entry:

```bash
(cd storage/framework/core/database && bun run build)
bun run bench:database-runtime -- --pairs=30
bun run bench:database-runtime:report -- \
  --input=bench/startup/results/database-latest.json \
  --output=bench/startup/results/database-report.md
```

The raw result retains every sample, exact Bun and source provenance, package
version, and the complete reachable local JavaScript graph for both entries.
The report recomputes both metric summaries and graph deltas before rendering.
The hosted startup workflow publishes the JSON and validated Markdown beside
the router startup artifacts.

## Spawn-to-ready diagnostic

The readiness diagnostic adds router construction, loopback binding, and one
verified HTTP response to the cold-process measurement:

```bash
(cd storage/framework/core/router && bun run build)
bun run bench:startup:ready -- --pairs=30
```

The parent starts its monotonic clock immediately before each process spawn.
The child registers the same static JSON route through `createStacksRouter()`
for each entry and reports only after `serve()` has bound an ephemeral loopback
port. The parent records the readiness handshake, requests the route, requires
the exact status, media type, and body, then stops the child. Results preserve
both spawn-to-listen and spawn-to-verified-response timings.

Each sample has a deadline. Missing or malformed handshakes, child diagnostics,
incorrect responses, and children that do not stop are hard failures. The same
source, build graph, runtime, environment, dependency, and pairing checks used
by the import diagnostic apply here.

## Peer readiness diagnostic

Compare the real stock Stacks, minimal Stacks, Elysia, Express, Fastify, Hono,
and Bun raw routing fixtures from fresh Bun processes:

```bash
bun install --cwd bench/routing --frozen-lockfile
bun run bench:startup:peers -- --runs=30
```

Every cycle measures all seven servers in a balanced process order. Each child
loads the shared production `static-json` scenario without application preloads
or env files, binds an ephemeral loopback port, and reports its RSS only after
listening. The parent records spawn-to-listen and spawn-to-verified-response
time, then requires the exact `200 application/json` response body before it
stops the child.

The JSON retains all samples, medians, ratios paired to Bun raw by cycle, sign
counts, exact peer versions, target definitions, runtime and host details,
framework package provenance, and source snapshots. Incomplete cycles,
unbalanced process positions, malformed handshakes, response drift, child
diagnostics, missing versions, and source changes are hard failures. The
validated report derives p25-p75 ranges for raw measurements and paired ratios
from the retained samples. This comparison is diagnostic only on developer
machines and shared hosted runners.

## Validated report

Combine one import artifact and one readiness artifact from the same source and
host into a readable report:

```bash
bun run bench:startup:report -- \
  --import=bench/startup/results/latest.json \
  --ready=bench/startup/results/listen-latest.json \
  --output=bench/startup/results/report.md
```

The report refuses to combine mismatched revisions, runtimes, hosts,
dependencies, entry paths, build graphs, or pair counts. It also revalidates
sample completeness, metric summaries, source stability, and exact HTTP
evidence before rendering. The hosted workflow retains this Markdown beside
the raw JSON and adds it to the job summary.

Render and revalidate a peer startup artifact independently:

```bash
bun run bench:startup:peer-report -- \
  --input=bench/startup/results/peers-latest.json \
  --output=bench/startup/results/peer-report.md
```

The scheduled workflow measures 30 peer cycles after installing the frozen
comparison dependency set. It retains the raw peer samples and validated
Markdown report with the root/runtime startup artifacts.
