# Idle memory benchmark

This suite measures resident memory after a server has handled sustained load
and then sat completely idle. Its default method matches the Bun 1.4.1 release
comparison: 60 seconds of load, followed by 180 seconds of idle.

```bash
bun run bench:memory
```

The runner uses the same targets, scenarios, byte-for-byte response parity
checks, and load generators as `bench/routing`. It samples only the server PID,
so memory used by the load generator is not counted. Linux reads `VmRSS` from
`/proc`; macOS and other Unix systems read RSS through `ps`.

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

No baseline is checked in. A publishable baseline requires a controlled machine
and a native load generator such as `oha` or `bombardier`. The built-in Bun
driver keeps the suite runnable everywhere, but its report is marked
direction-only because it competes with the server for runtime and CPU.

## Flags

```text
--targets      comma-separated target ids
--scenario     routing scenario to load (default static-json)
--driver       oha | bombardier | autocannon | builtin
--connections  concurrent connections (default 50)
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
