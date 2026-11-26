import { describe, expect, it, mock } from 'bun:test'

class PasskeyError extends Error {}
let keyCount = 1
const HASH = 'hash:right'

mock.module('./passkey-config', () => ({
  passkeyParty: () => ({ origin: 'https://app.example', name: 'App' }),
  passkeyJSON: (value: unknown) => Response.json(value),
  passkeyFailure: (error: unknown) => {
    if (!(error instanceof PasskeyError)) throw error
    return Response.json({ error: error.message }, { status: 400 })
  },
}))
mock.module('@stacksjs/security', () => ({ verifyHash: async (value: string, hash: string) => `hash:${value}` === hash }))
mock.module('@stacksjs/auth', () => ({
  PasskeyError,
  // The real one's rule: the last passkey goes only with another way in.
  removePasskey: async (_user: number, _id: string, alternative: (row: Record<string, unknown>) => Promise<boolean>) => {
    const other = await alternative({ password: HASH })
    if (keyCount === 1 && !other) throw new PasskeyError('Add a password or another passkey before removing your last passkey.')
    return true
  },
}))

const action = (await import('./PasskeyDestroyAction')).default as unknown as { handle: (request: unknown) => Promise<Response> }
const request = (password?: string) => ({
  user: async () => ({ id: 1 }),
  getParam: () => 'credential-1',
  get: (key: string) => key === 'password' ? password : undefined,
})

describe('removing a passkey', () => {
  it('removes the last one given the password', async () => {
    keyCount = 1
    expect((await action.handle(request('right'))).status).toBe(200)
  })

  it('says the password is wrong, not that there is none', async () => {
    keyCount = 1
    const response = await action.handle(request('wrong'))
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'The password is not right.' })
  })

  it('removes one of several with the session alone', async () => {
    keyCount = 2
    expect((await action.handle(request())).status).toBe(200)
  })
})
