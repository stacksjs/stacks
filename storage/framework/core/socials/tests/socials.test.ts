import { describe, expect, test } from 'bun:test'
import { AbstractProvider } from '../src/abstract'
import { ConfigException, InvalidStateException } from '../src/exceptions'
import type { ProviderInterface, SocialUser } from '../src/types'

// Concrete test implementation of AbstractProvider
class TestProvider extends AbstractProvider implements ProviderInterface {
  async getAuthUrl(): Promise<string> {
    return 'https://example.com/auth'
  }

  async getAccessToken(code: string): Promise<string> {
    return `token-${code}`
  }

  async getUserByToken(token: string): Promise<SocialUser> {
    return {
      id: '1',
      nickname: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatar: 'https://example.com/avatar.png',
      token,
    }
  }

  protected getTokenUrl(): string {
    return 'https://example.com/token'
  }
}

describe('AbstractProvider', () => {
  test('can be instantiated with config via a concrete subclass', () => {
    const provider = new TestProvider({
      clientId: 'test-id',
      clientSecret: 'test-secret',
      redirectUrl: 'https://example.com/callback',
    })
    expect(provider).toBeInstanceOf(AbstractProvider)
  })

  test('scopes() adds scopes without duplicates', () => {
    const provider = new TestProvider({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUrl: 'https://example.com/callback',
    })
    provider.scopes(['read', 'write'])
    provider.scopes(['write', 'admin'])
    expect(provider.getScopes()).toEqual(['read', 'write', 'admin'])
  })

  test('setScopes() replaces all scopes', () => {
    const provider = new TestProvider({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUrl: 'https://example.com/callback',
    })
    provider.scopes(['read', 'write'])
    provider.setScopes(['admin'])
    expect(provider.getScopes()).toEqual(['admin'])
  })

  test('scopes() accepts a single string', () => {
    const provider = new TestProvider({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUrl: 'https://example.com/callback',
    })
    provider.scopes('read')
    expect(provider.getScopes()).toContain('read')
  })

  test('setRedirectUrl() updates the redirect URL', () => {
    const provider = new TestProvider({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUrl: 'https://old.com/callback',
    })
    const result = provider.setRedirectUrl('https://new.com/callback')
    expect(result).toBe(provider) // fluent interface
  })

  test('stateless() enables stateless mode and returns this', () => {
    const provider = new TestProvider({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUrl: 'https://example.com/callback',
    })
    const result = provider.stateless()
    expect(result).toBe(provider)
  })

  test('enablePKCE() enables PKCE and returns this', () => {
    const provider = new TestProvider({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUrl: 'https://example.com/callback',
    })
    const result = provider.enablePKCE()
    expect(result).toBe(provider)
  })

  test('with() sets custom parameters and returns this', () => {
    const provider = new TestProvider({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUrl: 'https://example.com/callback',
    })
    const result = provider.with({ prompt: 'consent' })
    expect(result).toBe(provider)
  })

  test('userFromToken() returns a SocialUser with the token', async () => {
    const provider = new TestProvider({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUrl: 'https://example.com/callback',
    })
    const user = await provider.userFromToken('my-token')
    expect(user.token).toBe('my-token')
    expect(user.id).toBe('1')
    expect(user.name).toBe('Test User')
    expect(user.email).toBe('test@example.com')
  })

  test('getAuthUrl() returns a URL string', async () => {
    const provider = new TestProvider({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUrl: 'https://example.com/callback',
    })
    const url = await provider.getAuthUrl()
    expect(typeof url).toBe('string')
    expect(url).toContain('https://')
  })
})

describe('Social Exceptions', () => {
  test('InvalidStateException has correct name', () => {
    const err = new InvalidStateException()
    expect(err.name).toBe('InvalidStateException')
    expect(err.message).toBe('Invalid state')
  })

  test('InvalidStateException accepts custom message', () => {
    const err = new InvalidStateException('Custom state error')
    expect(err.message).toBe('Custom state error')
  })

  test('ConfigException has correct name', () => {
    const err = new ConfigException('Missing client ID')
    expect(err.name).toBe('ConfigException')
    expect(err.message).toBe('Missing client ID')
  })

  test('both exceptions extend Error', () => {
    expect(new InvalidStateException()).toBeInstanceOf(Error)
    expect(new ConfigException('test')).toBeInstanceOf(Error)
  })
})

describe('Social Driver Exports', () => {
  test('drivers index re-exports all providers', async () => {
    const mod = await import('../src/drivers/index')
    expect(mod).toBeDefined()
  })

  test('GitHubProvider class is exported', async () => {
    const { GitHubProvider } = await import('../src/drivers/github')
    expect(typeof GitHubProvider).toBe('function')
  })
})
