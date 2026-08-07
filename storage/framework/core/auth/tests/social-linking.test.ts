import type { SocialSignInStore } from '../src/socials'
import { describe, expect, it } from 'bun:test'
import { resolveSocialSignIn, SocialSignInRefusedError } from '../src/socials'

/**
 * The find-or-create policy behind social sign-in (stacksjs/stacks#2276).
 * The store is injected so the matrix runs without a database; the default
 * store is thin table access in `socials.ts`.
 *
 * The matching policy defaults to 'link' when config carries nothing, which
 * is what these tests run under.
 */

interface FakeState {
  links: Array<{ userId: number, provider: string, providerUserId: string, providerEmail: string | null }>
  users: Array<{ id: number, email: string }>
}

function storeWith(state: FakeState): SocialSignInStore {
  let nextId = Math.max(0, ...state.users.map(user => user.id)) + 1
  return {
    async findLink(provider, providerUserId) {
      const link = state.links.find(l => l.provider === provider && l.providerUserId === providerUserId)
      return link ? { userId: link.userId } : undefined
    },
    async createLink(link) {
      state.links.push(link)
    },
    async findUserIdByEmail(email) {
      return state.users.find(user => user.email === email)?.id
    },
    async createUser(attrs) {
      const id = nextId++
      state.users.push({ id, email: attrs.email })
      return id
    },
  }
}

const githubIdentity = {
  id: '99',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  nickname: 'ada',
  avatar: null,
}

describe('resolveSocialSignIn', () => {
  it('a linked identity resolves to its user, ignoring email drift', async () => {
    const state: FakeState = {
      links: [{ userId: 7, provider: 'github', providerUserId: '99', providerEmail: 'old@example.com' }],
      users: [{ id: 7, email: 'current@example.com' }],
    }

    const result = await resolveSocialSignIn('github', { ...githubIdentity, email: 'changed@example.com' }, storeWith(state))

    expect(result).toEqual({ userId: 7, createdUser: false, linked: false })
    expect(state.links).toHaveLength(1)
  })

  it('links a verified provider email onto the existing account', async () => {
    const state: FakeState = { links: [], users: [{ id: 3, email: 'ada@example.com' }] }

    const result = await resolveSocialSignIn('github', githubIdentity, storeWith(state))

    expect(result).toEqual({ userId: 3, createdUser: false, linked: true })
    expect(state.links[0]).toMatchObject({ userId: 3, provider: 'github', providerUserId: '99' })
  })

  it('REFUSES to link an unverified provider email onto an existing account', async () => {
    // The takeover: register victim@example.com at a provider that does not
    // verify email, sign in, inherit the victim's local account. The guard is
    // not configurable.
    const state: FakeState = { links: [], users: [{ id: 3, email: 'ada@example.com' }] }

    for (const emailVerified of [false, null, undefined]) {
      const attempt = resolveSocialSignIn('github', { ...githubIdentity, emailVerified }, storeWith(state))
      await expect(attempt).rejects.toThrow(SocialSignInRefusedError)
      await expect(attempt).rejects.toMatchObject({ reason: 'unverified-provider-email' })
    }
    expect(state.links).toHaveLength(0)
  })

  it('creates a user when no account matches, then links it', async () => {
    const state: FakeState = { links: [], users: [] }

    const result = await resolveSocialSignIn('github', githubIdentity, storeWith(state))

    expect(result.createdUser).toBe(true)
    expect(result.linked).toBe(true)
    expect(state.users).toHaveLength(1)
    expect(state.links[0]?.userId).toBe(result.userId)
  })

  it('creates even from an unverified email when no account exists to take over', async () => {
    // Unverified only matters when it could LINK to someone else's account.
    const state: FakeState = { links: [], users: [] }

    const result = await resolveSocialSignIn('github', { ...githubIdentity, emailVerified: false }, storeWith(state))

    expect(result.createdUser).toBe(true)
  })

  it('refuses when the provider shares no email and no link exists', async () => {
    const attempt = resolveSocialSignIn('github', { ...githubIdentity, email: null }, storeWith({ links: [], users: [] }))

    await expect(attempt).rejects.toMatchObject({ reason: 'no-email-to-create-with' })
  })

  it('normalizes the provider email before matching', async () => {
    const state: FakeState = { links: [], users: [{ id: 3, email: 'ada@example.com' }] }

    const result = await resolveSocialSignIn(
      'github',
      { ...githubIdentity, email: '  Ada@Example.com ' },
      storeWith(state),
    )

    expect(result.userId).toBe(3)
  })

  it('requires a provider and a provider user id', async () => {
    const store = storeWith({ links: [], users: [] })

    await expect(resolveSocialSignIn('', githubIdentity, store)).rejects.toThrow(TypeError)
    await expect(resolveSocialSignIn('github', { ...githubIdentity, id: '' }, store)).rejects.toThrow(TypeError)
  })
})
