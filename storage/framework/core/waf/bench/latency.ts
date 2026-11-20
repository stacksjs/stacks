/**
 * What the in-process WAF adds to a request: the time `Waf.inspect` takes, per
 * request, through bun:ffi.
 *
 *   ZIG_WAF_LIBRARY=/path/to/libzig-waf.dylib bun bench/latency.ts [rules.conf ...]
 *
 * With no rule files it uses the test fixture (CRS rules 942100 and 949110
 * only), which measures the FFI and transaction cost but not a full CRS
 * evaluation. Pass a CRS checkout's crs-setup.conf and rules/*.conf, in order,
 * for the number that matters in production.
 */

import { join } from 'node:path'
import process from 'node:process'
import { Waf } from '../src'

const rules = process.argv.slice(2)
const files = rules.length > 0 ? rules : [join(import.meta.dir, '../tests/fixtures/crs-sqli.conf')]
const waf = new Waf({ mode: 'detection', rules: files })

const connection = { clientAddress: '203.0.113.7', clientPort: 51234, serverAddress: '127.0.0.1', serverPort: 3008 }
const headers: [string, string][] = [
  ['host', 'app.example'],
  ['user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'],
  ['accept', 'text/html,application/xhtml+xml'],
  ['accept-language', 'en-US,en;q=0.9'],
  ['cookie', 'session=abc123; theme=dark'],
]
const form = `name=${'a'.repeat(400)}&email=person%40example.com&message=${'hello+world+'.repeat(40)}`

const scenarios = {
  'GET, clean': { ...connection, method: 'GET', uri: '/products?category=books&page=2', headers },
  'GET, SQL injection': { ...connection, method: 'GET', uri: `/search?q=${encodeURIComponent('1\' OR \'1\'=\'1')}`, headers },
  'POST, 1 KB form': { ...connection, method: 'POST', uri: '/contact', headers: [...headers, ['content-type', 'application/x-www-form-urlencoded']] as [string, string][], body: form },
}

// A full CRS costs milliseconds per request, so it takes a smaller run:
// BENCH_ITERATIONS=500 bun bench/latency.ts crs-setup.conf rules/*.conf
const ITERATIONS = Number(process.env.BENCH_ITERATIONS) || 20_000
const WARMUP = Math.max(10, Math.floor(ITERATIONS / 10))

console.log(`zig-waf in process, ${files.length} rule file(s), ${ITERATIONS} requests each, Bun ${Bun.version} on ${process.platform}-${process.arch}`)
console.log('scenario              p50 (us)   p99 (us)   mean (us)')
for (const [name, request] of Object.entries(scenarios)) {
  for (let i = 0; i < WARMUP; i++) waf.inspect(request)
  const samples = new Float64Array(ITERATIONS)
  for (let i = 0; i < ITERATIONS; i++) {
    const start = Bun.nanoseconds()
    waf.inspect(request)
    samples[i] = (Bun.nanoseconds() - start) / 1000
  }
  samples.sort()
  const mean = samples.reduce((sum, value) => sum + value, 0) / ITERATIONS
  const at = (q: number) => samples[Math.min(ITERATIONS - 1, Math.floor(q * ITERATIONS))]!.toFixed(1)
  console.log(`${name.padEnd(22)}${at(0.5).padStart(8)}${at(0.99).padStart(11)}${mean.toFixed(1).padStart(12)}`)
}
waf.close()
