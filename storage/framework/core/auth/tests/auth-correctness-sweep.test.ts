import { afterEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Gate } from '../src/gate'
import { BasePolicy } from '../src/policy'
import { RateLimiter } from '../src/rate-limiter'
import { selectActiveTeam } from '../src/team'

// Auth correctness sweep (stacksjs/stacks#1985). One functional test for the
// fail-open policy-helper-exposure fix, plus source-shape checks for the
// DB-/config-heavy fixes that can't be exercised without a live database.

const src = (rel: string) => readFileSync(resolve(__dirname, '..', 'src', rel), 'utf-8')

// ─── #1985: policy resolution must not expose BasePolicy helpers ───────────

class Post {
  constructor(public userId: number) {}
}

class PostPolicy extends BasePolicy<Post> {
  view(user: { id: number } | null, post: Post): boolean {
    return !!user && user.id === post.userId
  }
}

describe('gate policy resolution rejects inherited BasePolicy helpers (#1985)', () => {
  afterEach(() => Gate.flush())

  const owner = { id: 1 }
  const stranger = { id: 2 }

  it('a real ability method still resolves and enforces its rule', async () => {
    Gate.policy(Post, PostPolicy)
    expect(await Gate.allows('view', owner as any, new Post(1))).toBe(true)
    expect(await Gate.allows('view', stranger as any, new Post(1))).toBe(false)
  })

  it('the inherited allow() helper is NOT callable as an ability (was fail-open)', async () => {
    Gate.policy(Post, PostPolicy)
    // Before the fix, `allow` resolved BasePolicy.prototype.allow and returned
    // an unconditional ALLOW for anyone — a bypass. Now it must deny.
    expect(await Gate.allows('allow', owner as any, new Post(1))).toBe(false)
    expect(await Gate.allows('allow', null, new Post(1))).toBe(false)
  })

  it('allowIf / denyUnless / deny / before are likewise not resolvable abilities', async () => {
    Gate.policy(Post, PostPolicy)
    for (const reserved of ['allowIf', 'denyUnless', 'denyIf', 'deny', 'before', 'constructor']) {
      expect(await Gate.allows(reserved, owner as any, new Post(1))).toBe(false)
    }
  })

  it('an unknown ability still denies by default', async () => {
    Gate.policy(Post, PostPolicy)
    expect(await Gate.allows('nonexistent', owner as any, new Post(1))).toBe(false)
  })
})

// ─── #1985 follow-ups: after-callbacks on all paths + team role scoping ────

describe('gate after-callbacks apply to policy + default paths (#1985)', () => {
  afterEach(() => Gate.flush())

  it('a Gate.after() deny kill-switch overrides a policy ALLOW', async () => {
    Gate.policy(Post, PostPolicy)
    expect(await Gate.allows('view', { id: 1 } as any, new Post(1))).toBe(true)
    // lockdown: deny everything, including policy-resolved abilities (was bypassed)
    Gate.after(() => false)
    expect(await Gate.allows('view', { id: 1 } as any, new Post(1))).toBe(false)
  })

  it('a Gate.after() allow override flips a policy DENY', async () => {
    Gate.policy(Post, PostPolicy)
    expect(await Gate.allows('view', { id: 999 } as any, new Post(1))).toBe(false)
    Gate.after(() => true)
    expect(await Gate.allows('view', { id: 999 } as any, new Post(1))).toBe(true)
  })

  it('after-callbacks also run on the default-deny path', async () => {
    Gate.after(() => true)
    expect(await Gate.allows('unregistered', { id: 1 } as any, new Post(1))).toBe(true)
  })

  it('an after-callback returning void leaves the underlying result intact', async () => {
    Gate.policy(Post, PostPolicy)
    Gate.after(() => undefined)
    expect(await Gate.allows('view', { id: 1 } as any, new Post(1))).toBe(true)
    expect(await Gate.allows('view', { id: 2 } as any, new Post(1))).toBe(false)
  })
})

describe('team role resolution never borrows another team\'s role (#1985)', () => {
  it('selectActiveTeam returns the PICKED team role, not the highest-priority one', () => {
    const res = selectActiveTeam({
      memberships: [
        { team_id: 1, role: 'owner' }, // team A: owner
        { team_id: 2, role: null }, //    team B: no role
      ],
      activeTeamId: 2, // switch to team B
    })
    expect(res.teamId).toBe(2)
    expect(res.role).toBeNull() // must NOT be 'owner' borrowed from team A
  })

  it('resolveAuthenticatedMembership degrades a null role to "" instead of borrowing memberships[0]', () => {
    const s = src('team.ts')
    expect(s).toContain('role: picked.role ?? \'\'')
    expect(s).not.toContain('String(memberships[0]!.role)')
  })
})

// ─── #1985: account-scoped 2FA rate limit ──────────────────────────────────

describe('2FA verify has an account-scoped lockout independent of the password step (#1985)', () => {
  const twoFaKey = '2fa:42'
  const email = 'user@example.com'

  it('locks the 2FA key after MAX_ATTEMPTS failed codes', async () => {
    RateLimiter.useMemoryStore()
    await RateLimiter.resetAttempts(twoFaKey)
    for (let i = 0; i < 5; i++)
      await RateLimiter.recordFailedAttempt(twoFaKey)
    expect(await RateLimiter.isRateLimited(twoFaKey)).toBe(true)
    await expect(RateLimiter.validateAttempt(twoFaKey)).rejects.toThrow()
  })

  it('a correct password (resets the email key) does NOT clear the 2FA lockout', async () => {
    RateLimiter.useMemoryStore()
    await RateLimiter.resetAttempts(twoFaKey)
    for (let i = 0; i < 5; i++)
      await RateLimiter.recordFailedAttempt(twoFaKey)
    expect(await RateLimiter.isRateLimited(twoFaKey)).toBe(true)
    // password success clears the bare-email key — must not touch the 2fa: key
    await RateLimiter.resetAttempts(email)
    expect(await RateLimiter.isRateLimited(twoFaKey)).toBe(true)
  })

  it('verifyTwoFactorLoginCode wires validate/record/reset with the 2fa: key', () => {
    const s = src('two-factor.ts')
    expect(s).toContain('RateLimiter.validateAttempt(rateKey)')
    expect(s).toContain('RateLimiter.recordFailedAttempt(rateKey)')
    expect(s).toContain('RateLimiter.resetAttempts(rateKey)')
    expect(s).toContain('const TWO_FACTOR_RATE_LIMIT_PREFIX = \'2fa:\'')
  })
})

// ─── source-shape checks for the DB/config-heavy fixes ─────────────────────

describe('auth correctness sweep source-shape (#1985)', () => {
  it('getUserFromToken queries password_changed_at instead of the always-undefined property read', () => {
    const s = src('authentication.ts')
    expect(s).toContain('isIssuedBeforePasswordChange(accessToken.created_at, await getPasswordChangedAt(accessToken.user_id))')
    // the always-undefined bare-property read is gone from getUserFromToken
    expect(s).not.toContain('(user as any)?.password_changed_at')
  })

  it('passkey counter check rejects a rollback to 0 unless the stored value is also 0', () => {
    const s = src('passkey.ts')
    expect(s).toContain('newCounter <= stored && !(newCounter === 0 && stored === 0)')
    expect(s).not.toContain('newCounter !== 0 && newCounter <= stored')
  })

  it('bcrypt needsRehash default matches the creation default (12, not 10)', () => {
    const s = src('../../security/src/hash.ts')
    expect(s).toContain('config.bcrypt?.rounds || 12')
    // both the creation and rehash paths now agree on 12
    expect(s).not.toContain('config.bcrypt?.rounds || 10')
  })

  it('email-verification fails closed on an unparseable expires_at / created_at', () => {
    const s = src('email-verification.ts')
    expect(s).toContain('Number.isNaN(expiresAt.getTime())')
    expect(s).toContain('Number.isNaN(secondsSince)')
  })

  it('refresh rotation locks the row on postgres/mysql to prevent double-spend', () => {
    const s = src('tokens.ts')
    expect(s).toContain('(isPostgres || isMysql) ? \' FOR UPDATE\' : \'\'')
    expect(s).toContain('LIMIT 1${forUpdate}')
  })
})
