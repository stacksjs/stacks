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
- **Data files** (`@pmFromFile`) resolve from `dataDir`, by default the last
  rule file's directory: a CRS checkout's `rules/`, where its `.data` files are.
- **Methods.** CRS allows only GET, HEAD, POST and OPTIONS by default, which
  would refuse a Stacks API's PUT, PATCH and DELETE routes. The generated setup
  adds them; `allowedMethods` narrows or widens the list.
- **Bodies.** At most `maxBodyBytes` (default 128 KB) is read. Blocking refuses a
  larger body with 413, since past that point the rules see nothing. Detection
  inspects its start and logs the rest as unseen.
- **Detection by default.** Nothing switches to `blocking` by itself; read the
  detection log first.

`bun test ./tests` runs the engine tests when `ZIG_WAF_LIBRARY` is set and skips
them, with a warning, when it is not.

## Added latency

`bun bench/latency.ts [rule files]` times `Waf.inspect` per request through
`bun:ffi`. Measured on an Apple M-series Mac (Bun 1.4.3, zig-waf `ReleaseFast`),
p50 per request, before and after zig-utils/zig-waf#84, which makes the C ABI
allocate through malloc instead of a page per allocation (#82):

| Rules | Request | zig-waf 6c61dc6 | with #84 |
| --- | --- | --- | --- |
| test fixture (CRS 942100 + 949110), 20,000 runs | GET, clean | 252 us | 13 us |
| | GET, SQL injection | 438 us | 17 us |
| | POST, 1 KB form | 245 us | 16 us |
| full CRS 4 (55b09f5), paranoia level 1, 300 runs | GET, clean | 26.5 ms | 9.6 ms |
| | GET, SQL injection | 18.8 ms | 11.1 ms |
| | POST, 1 KB form | 42.3 ms | 37.5 ms |

For a GET, most of the full-CRS cost that remains is zig-waf compiling every
`@rx` and `@pm` operator again on every request (zig-utils/zig-waf#83). The form
post is different: compiling once takes only about a fifth off it, and the rest
is regex matching over the body in zig-regex's backtracking engine, whose cost
grows with pattern size times input length. Measure with your own rules (a full
CRS needs a smaller run):

```sh
BENCH_ITERATIONS=300 bun bench/latency.ts crs-setup.conf rules/*.conf
```

The CI job `waf` prints the fixture table for Linux.
