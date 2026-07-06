/**
 * Tests for the workspace-switcher core (stacksjs/status#1): the pure
 * `selectActiveTeam` resolver and the active-team cookie helpers. These are
 * request/DB-free, so they run in-process — the decision logic every app that
 * has multi-team accounts needs, in one place.
 */
import { describe, expect, test } from 'bun:test'
import {
  ACTIVE_TEAM_COOKIE,
  buildActiveTeamCookie,
  clearActiveTeamCookie,
  getActiveTeamPreference,
  selectActiveTeam,
} from '../src/team'

describe('selectActiveTeam', () => {
  const memberships = [
    { team_id: 7, role: 'member' },
    { team_id: 3, role: 'owner' },
    { team_id: 5, role: 'admin' },
  ]

  test('falls back to the highest-priority membership when nothing is pinned', () => {
    expect(selectActiveTeam({ memberships })).toEqual({ teamId: 3, role: 'owner' })
  })

  test('owner beats admin beats any other role', () => {
    expect(selectActiveTeam({ memberships: [{ team_id: 9, role: 'admin' }, { team_id: 8, role: 'member' }] }))
      .toEqual({ teamId: 9, role: 'admin' })
    expect(selectActiveTeam({ memberships: [{ team_id: 9, role: 'member' }, { team_id: 8, role: 'viewer' }] }))
      .toEqual({ teamId: 9, role: 'member' })
  })

  test('honors a pinned team the user is a member of', () => {
    expect(selectActiveTeam({ memberships, activeTeamId: 5 })).toEqual({ teamId: 5, role: 'admin' })
  })

  test('ignores a pinned team the user is NOT a member of (falls back)', () => {
    expect(selectActiveTeam({ memberships, activeTeamId: 999 })).toEqual({ teamId: 3, role: 'owner' })
  })

  test('lets an operator pin any team when allowAnyTeam is set', () => {
    expect(selectActiveTeam({ memberships, activeTeamId: 999, allowAnyTeam: true }))
      .toEqual({ teamId: 999, role: 'admin' })
  })

  test('a member role still wins over allowAnyTeam for a team they belong to', () => {
    expect(selectActiveTeam({ memberships, activeTeamId: 5, allowAnyTeam: true }))
      .toEqual({ teamId: 5, role: 'admin' })
  })

  test('no memberships resolves to no team', () => {
    expect(selectActiveTeam({ memberships: [] })).toEqual({ teamId: null, role: null })
    expect(selectActiveTeam({ memberships: [], activeTeamId: 5 })).toEqual({ teamId: null, role: null })
    // ...unless the operator may reach any team
    expect(selectActiveTeam({ memberships: [], activeTeamId: 5, allowAnyTeam: true }))
      .toEqual({ teamId: 5, role: 'admin' })
  })

  test('tolerates string team ids / malformed pins', () => {
    expect(selectActiveTeam({ memberships: [{ team_id: '4', role: 'owner' }], activeTeamId: 4 }))
      .toEqual({ teamId: 4, role: 'owner' })
    expect(selectActiveTeam({ memberships, activeTeamId: Number.NaN })).toEqual({ teamId: 3, role: 'owner' })
  })

  test('a custom rolePriority overrides the default owner>admin ordering', () => {
    const priority = { member: 0 }
    expect(selectActiveTeam({ memberships, rolePriority: priority })).toEqual({ teamId: 7, role: 'member' })
  })
})

describe('active-team cookie helpers', () => {
  test('getActiveTeamPreference reads a positive integer from the cookie', () => {
    const req = { cookies: { get: (n: string) => (n === ACTIVE_TEAM_COOKIE ? '42' : null) } }
    expect(getActiveTeamPreference(req)).toBe(42)
  })

  test('getActiveTeamPreference rejects missing / non-positive / non-numeric values', () => {
    expect(getActiveTeamPreference({ cookies: { get: () => null } })).toBeNull()
    expect(getActiveTeamPreference({ cookies: { get: () => '0' } })).toBeNull()
    expect(getActiveTeamPreference({ cookies: { get: () => '-3' } })).toBeNull()
    expect(getActiveTeamPreference({ cookies: { get: () => 'abc' } })).toBeNull()
    expect(getActiveTeamPreference({})).toBeNull()
  })

  test('buildActiveTeamCookie sets an HttpOnly, SameSite=Lax cookie; Secure only when asked', () => {
    const c = buildActiveTeamCookie(7)
    expect(c).toContain(`${ACTIVE_TEAM_COOKIE}=7`)
    expect(c).toContain('HttpOnly')
    expect(c).toContain('SameSite=Lax')
    expect(c).toContain('Path=/')
    expect(c).not.toContain('Secure')
    expect(buildActiveTeamCookie(7, { secure: true })).toContain('Secure')
  })

  test('clearActiveTeamCookie expires the cookie', () => {
    expect(clearActiveTeamCookie()).toContain(`${ACTIVE_TEAM_COOKIE}=;`)
    expect(clearActiveTeamCookie()).toContain('Max-Age=0')
  })
})
