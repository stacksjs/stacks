import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const router = join(import.meta.dir, '..')

test('the published router retains its complete public API and contextual request types', () => {
  const build = Bun.spawnSync({ cmd: [process.execPath, 'build.ts'], cwd: router, stdout: 'pipe', stderr: 'pipe' })
  expect(build.exitCode, build.stderr.toString()).toBe(0)

  const source = readFileSync(join(router, 'src/stacks-router.ts'), 'utf8')
  const declaration = readFileSync(join(router, 'dist/stacks-router.d.ts'), 'utf8')
  const exports = [...source.matchAll(/^export (?:async )?(?:function|interface|type|const) (\w+)/gm)].map(match => match[1]!)
  expect(exports.length).toBeGreaterThan(40)
  for (const name of new Set(exports))
    expect(declaration, `Missing published router export: ${name}`).toMatch(new RegExp(`\\bexport (?:declare )?(?:function|interface|type|const) ${name}\\b`))

  const directory = mkdtempSync(join(router, '.published-contract-'))
  try {
    writeFileSync(join(directory, 'consumer.ts'), `
import { createStacksRouter, route, withRouteAdmission } from '../dist/stacks-router.js'
import type { StacksRouterConfig, StacksRouterInstance, ChainableRoute, RouteAdmission } from '../dist/stacks-router.js'
const options: StacksRouterConfig = { autoDiscoverRoutes: false, csrf: false }
const router: StacksRouterInstance = createStacksRouter(options)
const chain: ChainableRoute = router.get('/example', request => {
  const url: string = request.url
  // @ts-expect-error A contextual request must not silently become any.
  const invalid: number = request.url
  return Response.json({ url, invalid })
})
chain.middleware('auth').skipCsrf().name('example')
const reply: Promise<Response> = router.handleRequest(new Request('https://example.invalid/example'))
const admission: RouteAdmission = handler => handler ? undefined : 'Missing handler'
void withRouteAdmission(admission, async () => { route.get('/another', () => new Response('ok')) })
void reply
`)
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, skipLibCheck: true, target: 'ESNext', module: 'Preserve', moduleResolution: 'Bundler', types: ['bun'] },
      files: ['consumer.ts'],
    }))
    const check = Bun.spawnSync({ cmd: [process.execPath, 'x', '--bun', 'tsc', '--project', join(directory, 'tsconfig.json'), '--pretty', 'false'], cwd: router, stdout: 'pipe', stderr: 'pipe' })
    expect(check.exitCode, `${check.stdout.toString()}\n${check.stderr.toString()}`).toBe(0)
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 30_000)
