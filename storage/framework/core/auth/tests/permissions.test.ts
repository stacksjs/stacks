import { describe, expect, it } from 'bun:test'
import { defineRolePermissions } from '../src/permissions'

const permissions = defineRolePermissions({
  owner: ['members:view', 'members:manage'],
  member: ['members:view'],
} as const)

describe('role permissions', () => {
  it('checks roles and role-bearing subjects', () => {
    expect(permissions.roleCan('owner', 'members:manage')).toBe(true)
    expect(permissions.can({ role: 'member' }, 'members:manage')).toBe(false)
    expect(permissions.can(null, 'members:view')).toBe(false)
  })

  it('checks any/all grants and returns immutable role grants', () => {
    expect(permissions.canAny({ role: 'member' }, ['members:view', 'members:manage'])).toBe(true)
    expect(permissions.canAll({ role: 'member' }, ['members:view', 'members:manage'])).toBe(false)
    expect(Object.isFrozen(permissions.forRole('owner'))).toBe(true)
  })
})
