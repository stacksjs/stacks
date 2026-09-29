import { describe, expect, it } from 'bun:test'
import { parseAuthClientArgs } from '../src/auth/client-options'

describe('auth:client provider options', () => {
  it('preserves the legacy client defaults', () => {
    expect(parseAuthClientArgs([])).toEqual({
      name: 'OAuth Client',
      redirects: ['http://localhost'],
      personal: false,
      password: false,
      provider: false,
      ownerId: null,
      type: 'confidential',
      scopes: [],
      resources: [],
    })
  })

  it('parses an explicit public provider registration', () => {
    expect(parseAuthClientArgs([
      '--provider',
      '--public',
      '--owner=42',
      '--name',
      'BugHQ Browser',
      '--redirect',
      'https://client.example/callback,http://127.0.0.1:4100/callback',
      '--scopes=issues:read,profile:read',
      '--resources',
      'bughq',
    ])).toEqual({
      name: 'BugHQ Browser',
      redirects: ['https://client.example/callback', 'http://127.0.0.1:4100/callback'],
      personal: false,
      password: false,
      provider: true,
      ownerId: 42,
      type: 'public',
      scopes: ['issues:read', 'profile:read'],
      resources: ['bughq'],
    })
  })

  it('leaves invalid owner ids for the command boundary to reject', () => {
    expect(parseAuthClientArgs(['--provider', '--owner', 'not-a-user']).ownerId).toBeNull()
  })
})
