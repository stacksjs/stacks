import { getResizeObserver } from '../../src/observer'
const Native = window.ResizeObserver
Reflect.deleteProperty(window, 'ResizeObserver')
const Polyfill = getResizeObserver()
Reflect.set(window, 'ResizeObserver', undefined)
if (typeof getResizeObserver() !== 'function') throw new Error('undefined native constructor must fall back')
window.ResizeObserver = Native
const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message) }
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const frames = async () => { for (let n = 0; n < 8; n++) await frame() }
const box = document.createElement('div')
box.style.cssText = 'width:100px;height:50px;position:relative'
document.body.append(box)
let nativeCalls = 0, polyCalls = 0
const native = new Native(() => { nativeCalls++ })
const poly = new Polyfill(() => { polyCalls++ })
try {
  native.observe(box); poly.observe(box); poly.observe(box)
  await frames()
  check(nativeCalls === 1, 'native initial control')
  check(polyCalls === 1, 'unchanged elements must notify only once')
  box.style.left = '20px'
  await frames()
  check(polyCalls === 1, 'position changes are not resizes')
  box.style.width = '200px'
  await frames()
  check(polyCalls === 2, 'real resize must notify')
  poly.unobserve(box)
  box.style.width = '250px'
  await frames()
  check(polyCalls === 2, 'unobserved target notified')
  poly.observe(box)
  await frames()
  check(polyCalls === 3, 'reobserving requires initial delivery')
}
finally { native.disconnect(); poly.disconnect() }

let expectedErrors = 0, recovered = 0, nativeRecovered = 0
window.addEventListener('error', event => { if (event.message.includes('EXPECTED helper callback')) { expectedErrors++; event.preventDefault() } })
const throwing = new Polyfill(() => { if (++recovered === 1) throw new Error('EXPECTED helper callback fallback') })
const nativeThrowing = new Native(() => { if (++nativeRecovered === 1) throw new Error('EXPECTED helper callback native') })
try {
  throwing.observe(box); nativeThrowing.observe(box)
  await frames()
  box.style.width = '300px'
  await frames()
  check(nativeRecovered === 2, 'native recovery control')
  check(recovered === 2, 'throwing callback must not stop future observations')
  check(expectedErrors === 2, 'callback errors must reach normal error reporting')
}
finally { throwing.disconnect(); nativeThrowing.disconnect() }

let disconnectedCalls = 0
// eslint-disable-next-line pickier/no-unused-vars
const disconnecting = new Polyfill((entries, observer) => { disconnectedCalls++; observer.disconnect() })
disconnecting.observe(box)
await frames()
box.style.width = '350px'
await frames()
check(disconnectedCalls === 1, 'disconnect inside callback scheduled more deliveries')
const other = document.createElement('div')
box.id = 'first'; other.id = 'second'; other.style.cssText = 'width:10px;height:10px'
document.body.append(other)
const deliveries: string[][] = []
const multi = new Polyfill(entries => { deliveries.push(entries.map(entry => entry.target.id).sort()) })
try {
  multi.observe(box); multi.observe(other)
  await frames()
  other.style.width = '20px'
  await frames()
  multi.unobserve(box)
  box.style.width = '400px'
  await frames()
  multi.disconnect()
  multi.observe(box)
  await frames()
  check(JSON.stringify(deliveries) === JSON.stringify([['first', 'second'], ['second'], ['first']]), 'multi-target cleanup or delivery changed')
}
finally { multi.disconnect() }
const read = async (path: string) => {
  const response = await fetch(path)
  check(response.status === 200, `HTTP ${path} returned ${response.status}`)
  return response.json()
}
const first = await read('/contracts'), second = await read('/contracts')
check(first.first === 20 && second.second === 2, 'pipeline leaked between HTTP consumers')
check(!second.sibling && second.restored === 'original', 'macro lifecycle crossed class boundaries')
check(!Object.hasOwn(second.omitted, '1'), 'numeric secret field survived omission')
check(second.graph.selfIsRoot && second.changed.balance === 'text', 'graph or path update failed')
const files = await read('/files')
check(files.external === 'external' && !files.localExists, 'file deletion crossed symlink boundary')
check(Object.hasOwn(files.config, '__proto__') && !Object.hasOwn(files.config, 'inherited'), 'config projection lost own key policy')
const retried = await read('/retry')
check(retried.value === 42 && retried.attempts === 3 && retried.invalidCalls === 0 && retried.error === 'Unknown error', 'retry/error boundary failed')
const markup = await fetch('/markdown')
check(markup.status === 200, 'Markdown endpoint failed')
const section = document.createElement('section')
section.innerHTML = await markup.text()
document.body.append(section)
check(section.querySelectorAll('th').length === 2 && section.querySelectorAll('td').length === 2, 'table dimensions changed')
check(section.querySelector('td')?.textContent === 'a|bnext' && section.querySelectorAll('br').length === 1, 'text cell lost pipe or newline')
const result = document.createElement('pre')
result.textContent = JSON.stringify({ polyCalls, recovered, nativeRecovered, expectedErrors, disconnectedCalls,
  http: { pipeline: second.second, omitted: Object.keys(second.omitted), graph: second.graph.selfIsRoot, external: files.external,
    prototypeOwn: Object.hasOwn(files.config, '__proto__'), retry: retried.value, cells: section.querySelectorAll('td').length } })
document.body.append(result)
