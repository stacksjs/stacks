import { debounce, throttle } from '../../src/debounce'
import { safeJsonStringify } from '../../src/safe-json'
import { merge } from '../../src/merge'
import { mask } from '../../../strings/src/helpers'
const seen: string[] = []
let completed: () => void = () => {}
const done = new Promise<void>(resolve => { completed = resolve })
const debounced = debounce((value: string) => { seen.push(value); if (value === 'first') debounced('second'); else completed(); return seen.length }, 10)
debounced('first')
// Wait for the actual browser timers, including work queued by the callback.
await done
debounced.cancel()
const limited = throttle(() => 42, 50)
const throttled = limited()
limited.cancel()
const row = { id: 1 }
const source = Object.assign(Object.create({ inherited: true }), { url: new URL('https://example.test/path') })
const merged = merge<Record<string, any>>({}, source)
let invalidMask = false
try { mask('secret', '*', 1.5, 2) }
catch (error) { invalidMask = error instanceof RangeError }
const get = async (path: string) => { const response = await fetch(path); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() }
const first = await get('/feed')
const second = await get(first.next_page_url)
const composite = await get('/composite')
const tupleSecond = await get(composite.next_page_url)
const previous = await get(second.prev_page_url)
const tuplePrevious = await get(tupleSecond.prev_page_url)
const pre = document.createElement('pre')
pre.textContent = JSON.stringify({ seen, throttled, shared: safeJsonStringify({ first: row, second: row }),
  url: merged.url.href, inherited: Object.hasOwn(merged, 'inherited'), invalidMask,
  first: first.data[0].id, second: second.data[0].id, tupleSecond: tupleSecond.data[0].id, previous: previous.data[0].id, tuplePrevious: tuplePrevious.data[0].id,
  snapshot: await get('/snapshot'), cache: await get('/cache'), move: await get('/move') })
document.body.append(pre)
