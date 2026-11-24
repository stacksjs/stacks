import { describe, expect, it } from 'bun:test'
import { frameworkRegistry, frameworkRegistryFetch, PANTRY_NPM_REGISTRY } from '../src/framework-registry'

function recorder(answer: (url: string) => Response | Promise<Response>) {
  const calls: string[] = []
  const read = async (url: string) => {
    calls.push(url)
    return answer(url)
  }
  return { calls, read }
}

describe('framework registry reads', () => {
  it('asks Pantry first and stops there when it answers', async () => {
    const { calls, read } = recorder(() => Response.json({ name: 'stacks' }))
    const response = await frameworkRegistryFetch(read, {})('https://registry.npmjs.org/stacks')
    expect(await response.json()).toEqual({ name: 'stacks' })
    expect(calls).toEqual([`${PANTRY_NPM_REGISTRY}/stacks`])
  })

  it('keeps the scoped and versioned path as written', async () => {
    const { calls, read } = recorder(() => Response.json({}))
    await frameworkRegistryFetch(read, {})('https://registry.npmjs.org/@stacksjs%2factions/0.75.700')
    expect(calls).toEqual([`${PANTRY_NPM_REGISTRY}/@stacksjs%2factions/0.75.700`])
  })

  it('falls back to npm on a refusal or a network failure', async () => {
    const refused = recorder(url => url.startsWith(PANTRY_NPM_REGISTRY) ? new Response('nope', { status: 404 }) : Response.json({ from: 'npm' }))
    expect(await (await frameworkRegistryFetch(refused.read, {})('https://registry.npmjs.org/stacks')).json()).toEqual({ from: 'npm' })
    expect(refused.calls).toEqual([`${PANTRY_NPM_REGISTRY}/stacks`, 'https://registry.npmjs.org/stacks'])

    const offline = recorder((url) => {
      if (url.startsWith(PANTRY_NPM_REGISTRY)) throw new Error('ECONNREFUSED')
      return Response.json({ from: 'npm' })
    })
    expect(await (await frameworkRegistryFetch(offline.read, {})('https://registry.npmjs.org/stacks')).json()).toEqual({ from: 'npm' })

    // A fetch that throws before returning a promise falls back too.
    const strict = (url: string) => {
      if (!url.startsWith('https://registry.npmjs.org/')) throw new Error('Unexpected metadata request')
      return Promise.resolve(Response.json({ from: 'npm' }))
    }
    expect(await (await frameworkRegistryFetch(strict, {})('https://registry.npmjs.org/stacks')).json()).toEqual({ from: 'npm' })
  })

  it('passes other URLs through untouched', async () => {
    const { calls, read } = recorder(() => Response.json({}))
    await frameworkRegistryFetch(read, {})('https://api.github.com/repos/stacksjs/stacks')
    expect(calls).toEqual(['https://api.github.com/repos/stacksjs/stacks'])
  })

  it('honors STACKS_FRAMEWORK_REGISTRY, with npm meaning npm alone', async () => {
    expect(frameworkRegistry({})).toBe(PANTRY_NPM_REGISTRY)
    expect(frameworkRegistry({ STACKS_FRAMEWORK_REGISTRY: 'npm' })).toBeNull()
    expect(frameworkRegistry({ STACKS_FRAMEWORK_REGISTRY: 'https://registry.npmjs.org/' })).toBeNull()
    expect(frameworkRegistry({ STACKS_FRAMEWORK_REGISTRY: 'http://localhost:4873/npm/' })).toBe('http://localhost:4873/npm')

    const { calls, read } = recorder(() => Response.json({}))
    await frameworkRegistryFetch(read, { STACKS_FRAMEWORK_REGISTRY: 'npm' })('https://registry.npmjs.org/stacks')
    expect(calls).toEqual(['https://registry.npmjs.org/stacks'])
  })
})
