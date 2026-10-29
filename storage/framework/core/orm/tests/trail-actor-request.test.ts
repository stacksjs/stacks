import { describe, expect, it } from 'bun:test'
import { runWithRequest } from '@stacksjs/router'
import { resolveTrailActorId } from '../src/traits/actor'

describe('trail actor from authenticated requests', () => {
  it('uses the user stamped by auth middleware even when the request has a user macro', async () => {
    const request = { _authenticatedUser: { id: 42 }, user: () => undefined } as any
    expect(await runWithRequest(request, () => resolveTrailActorId())).toBe(42)
  })

  it('keeps concurrent request identities separate', async () => {
    const ids = await Promise.all([17, 29].map(id => runWithRequest({ _authenticatedUser: { id } } as any, async () => {
      await Promise.resolve()
      return resolveTrailActorId()
    })))
    expect(ids).toEqual([17, 29])
    expect(await resolveTrailActorId()).toBeNull()
  })
})
