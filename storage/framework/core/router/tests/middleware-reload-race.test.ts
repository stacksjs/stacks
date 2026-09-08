import { describe, expect, test } from 'bun:test'
import { unlinkSync, writeFileSync } from 'node:fs'
import { appPath } from '@stacksjs/path'
import { clearMiddlewareCache, clearRouteMiddlewareRegistry, createStacksRouter } from '../src/stacks-router'

describe('middleware reload during an unresolved import', () => {
  const cases = [
    { name: 'named guard, cold replacement', negated: false, warmReplacement: false },
    { name: 'named guard, warm replacement', negated: false, warmReplacement: true },
    { name: 'negated guard, cold replacement', negated: true, warmReplacement: false },
    { name: 'negated guard, warm replacement', negated: true, warmReplacement: true },
    { name: 'automatic CSRF, warm replacement', negated: false, warmReplacement: true, csrf: true },
    { name: 'invalid old handler, warm replacement', negated: false, warmReplacement: true, broken: true },
  ]
  for (const { name, negated, warmReplacement, csrf, broken } of cases) {
    test(name, async () => {
      const id = `ReloadRace${crypto.randomUUID().replaceAll('-', '')}`
      const alias = csrf ? 'csrf' : `__${id}`
      const files = ['Gate', 'Old', 'New'].map(suffix => appPath(`Middleware/${id}${suffix}.ts`))
      const aliases = (await import(appPath('Middleware.ts'))).default as Record<string, string>
      const originalAlias = aliases[alias]
      writeFileSync(files[0], `
export const started = Promise.withResolvers()
export const release = Promise.withResolvers()
`)
      writeFileSync(files[1], `
import { started, release } from './${id}Gate'
started.resolve()
await release.promise
export default ${broken ? '{}' : `{ handle() { ${negated ? "throw new Response('old refusal', { status: 403 })" : ''} } }`}
`)
      writeFileSync(files[2], `
export default { handle() { ${negated ? '' : "throw new Response('new refusal', { status: 403 })"} } }
`)
      const gate = await import(files[0]) as {
        started: { promise: Promise<void> }
        release: { resolve: () => void }
      }
      let pending: Promise<Response> | undefined
      try {
        aliases[alias] = `${id}Old`
        clearMiddlewareCache()
        const router = createStacksRouter({ autoDiscoverRoutes: false })
        if (csrf)
          router.post('/reload-race', () => ({ ok: true }))
        else
          router.get('/reload-race', () => ({ ok: true })).middleware(`${negated ? '!' : ''}${alias}`)
        const dispatch = (path = '/reload-race') => router.handleRequest(new Request(`http://localhost${path}`, {
          method: csrf ? 'POST' : 'GET',
          headers: { accept: 'application/json' },
        }))
        pending = dispatch()
        await gate.started.promise

        aliases[alias] = `${id}New`
        clearMiddlewareCache()
        if (warmReplacement)
          expect((await dispatch()).status).toBe(403)

        // An in-flight request may finish with the old policy. Its cache writes
        // must not affect requests that start after this reload.
        gate.release.resolve()
        await (await pending).arrayBuffer()
        for (let i = 0; i < 2; i++)
          expect((await dispatch()).status).toBe(403)

        if (!csrf) {
          // New descriptors must also see the replacement module and negation
          // caches, even if the original route descriptor was already warmed.
          router.get('/reload-race/fresh', () => ({ ok: true })).middleware(`${negated ? '!' : ''}${alias}:fresh`)
          router.get('/reload-race/inverse', () => ({ ok: true })).middleware(`${negated ? '' : '!'}${alias}:inverse`)
          expect((await dispatch('/reload-race/fresh')).status).toBe(403)
          expect((await dispatch('/reload-race/inverse')).status).toBe(200)
        }
      }
      finally {
        gate.release.resolve()
        if (pending) await pending
        if (originalAlias === undefined)
          delete aliases[alias]
        else
          aliases[alias] = originalAlias
        for (const file of files) unlinkSync(file)
        clearMiddlewareCache()
        clearRouteMiddlewareRegistry()
      }
    })
  }
})
