import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStacksRouter } from '../../../router/src/stacks-router'
import { omit, setPath } from '../../../objects/src/transform'
import { deepMerge, objectMap } from '../../../objects/src'
import { deleteFiles, getFiles } from '../../../storage/src/files'
import { updateConfigFile } from '../../../storage/src/helpers'
import { retry, calculateDelay } from '../../../browser/src/utils/retry'
import { Macroable } from '../../src/macroable'
import { Pipeline } from '../../src/pipeline'
import { markdownTable } from '../../src/markdown'
import { getErrorMessage } from '../../src/errors'

export function startHelperServer(script = '') {
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-helper-http-'))
  const inside = join(fixture, 'inside'), outside = join(fixture, 'outside')
  mkdirSync(inside); mkdirSync(outside); writeFileSync(join(outside, 'keep.txt'), 'external')
  const pipes = [(n: number, next: (n: number) => number) => next(n + 1)]
  class A extends Macroable { read() { return 'original' } }
  class B extends Macroable {}
  const router = createStacksRouter({ autoDiscoverRoutes: false })
  router.get('/contracts', () => {
    const first = Pipeline.send(1).through(pipes).pipe((n, next) => next(n * 10)).thenReturn()
    const second = Pipeline.send(1).through(pipes).thenReturn()
    A.macro('label', () => 'A')
    A.macro('read', () => 'override', true)
    let sibling: boolean
    try { sibling = B.hasMacro('label') }
    finally { A.flushMacros() }
    const source: any = { name: 'graph' }; source.self = source
    const graph = deepMerge({} as any, source)
    const array = Object.assign(Array<string>(3), { label: 'kept' }); array[2] = 'old'
    const changed = setPath(array, [2], 'new')
    return { first, second, sibling, restored: new A().read(), graph: { name: graph.name, selfIsRoot: graph.self === graph },
      omitted: omit({ 1: 'secret', 2: 'public' }, [1]), filtered: objectMap({ account: 'owner' }, () => undefined),
      changed: setPath({ balance: 1 }, ['balance'], 'text'), array: { hole: !Object.hasOwn(changed, 0), label: changed.label, value: changed[2] } }
  })
  router.get('/files', async () => {
    writeFileSync(join(inside, 'local.txt'), 'local')
    symlinkSync(outside, join(inside, 'linked'), 'dir')
    const listed = getFiles(inside).map(path => path.slice(inside.length + 1))
    deleteFiles(inside)
    const file = join(fixture, 'config.json')
    writeFileSync(file, '{"kept":true}')
    const update = Object.setPrototypeOf(JSON.parse('{"__proto__":{"flag":1},"value":2}'), { inherited: 'unwanted' })
    await updateConfigFile(file, update)
    return { listed, external: readFileSync(join(outside, 'keep.txt'), 'utf8'), localExists: existsSync(join(inside, 'local.txt')), config: JSON.parse(readFileSync(file, 'utf8')) }
  })
  router.get('/retry', async () => {
    let attempts = 0, invalidCalls = 0, invalid = false
    const value = await retry(async () => { if (++attempts < 3) throw new Error('transient'); return 42 }, { initialDelay: 0, jitter: false })
    try { await retry(async () => ++invalidCalls, { retries: NaN }) }
    catch (error) { invalid = error instanceof RangeError }
    const hostile = Object.defineProperty(Object.create(null), 'message', { get() { throw new Error('getter failed') } })
    return { attempts, value, invalid, invalidCalls, delay: calculateDelay(40, 1000, 2), error: getErrorMessage(hostile) }
  })
  router.get('/markdown', () => new Response(Bun.markdown.html(markdownTable([['Name'], ['a|b\nnext', 30]])), { headers: { 'content-type': 'text/html; charset=utf-8' } }))
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/client.js') return new Response(script, { headers: { 'content-type': 'application/javascript' } })
    if (path === '/') return new Response('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><script type="module" src="/client.js"></script></body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } })
    return router.bunRouter.handleRequest(request)
  } })
  return { url: `http://127.0.0.1:${server.port}`, close() { server.stop(true); A.flushMacros(); B.flushMacros(); rmSync(fixture, { recursive: true, force: true }) } }
}
