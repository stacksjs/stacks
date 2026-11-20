# @stacksjs/waf

[zig-waf](https://github.com/zig-utils/zig-waf) in process, through `bun:ffi`.

On a box deploy, rpx's dataplane runs zig-waf in front of the app. This package
is for the places it does not: `buddy dev`, serverless, any app not behind rpx.
The framework's `waf` middleware uses it; add that to a route or a group.

```ts
import { Waf } from '@stacksjs/waf'

const waf = new Waf({
  mode: 'detection', // or 'blocking'
  library: '/opt/zig-waf/lib/libzig-waf.so', // or set ZIG_WAF_LIBRARY
  rules: ['/opt/crs/crs-setup.conf', ...crsRuleFiles], // zig-waf ships no rules
})

const decision = waf.inspect({
  method: 'GET',
  uri: '/search?q=1',
  headers: [['host', 'example.com']],
  clientAddress: '203.0.113.7',
  clientPort: 51234,
  serverAddress: '127.0.0.1',
  serverPort: 3008,
})
// { matched: true, enforced: false, status: 403, ruleId: 949110 } in detection mode
```

- **Rules are required.** zig-waf bundles none, so `rules` names SecLang files in
  load order, usually an OWASP CRS checkout. With none it refuses to start: a
  firewall that matches nothing looks the same as one that found nothing wrong.
- **The library is named, never searched for**: `library`, then
  `ZIG_WAF_LIBRARY`. It is `lib/libzig-waf.{dylib,so}` in a zig-waf release, or
  `zig-out/lib/` after `zig build`.
- **Detection by default.** Nothing switches to `blocking` by itself; read the
  detection log first.

`bun test ./tests` runs the engine tests when `ZIG_WAF_LIBRARY` is set and skips
them, with a warning, when it is not.

## Added latency

`bun bench/latency.ts` times `Waf.inspect` per request. On an Apple M-series
Mac (Bun 1.4.3, zig-waf built `ReleaseFast`), with the test fixture's two CRS
rules (942100 and 949110), 20,000 requests each:

| Request | p50 | p99 | mean |
| --- | --- | --- | --- |
| GET, clean | 207 us | 2.0 ms | 393 us |
| GET, SQL injection | 341 us | 2.2 ms | 440 us |
| POST, 1 KB form | 195 us | 1.1 ms | 234 us |

Almost all of that is phase-1 evaluation inside the engine: a rule that fires
costs about 100 us even when it does nothing (zig-utils/zig-waf#82), and the
generated setup and the fixture fire three. A full CRS fires dozens per request,
so expect milliseconds until that is fixed, and measure with your own rules:
`bun bench/latency.ts crs-setup.conf rules/*.conf`. The CI job `waf` prints the
same table for Linux.
