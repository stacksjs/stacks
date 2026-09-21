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
