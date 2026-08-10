import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('dashboard role authorization contract', () => {
  const action = readFileSync(resolve('storage/framework/defaults/app/Actions/Dashboard/Auth/MeAction.ts'), 'utf8')
  const store = readFileSync(resolve('storage/framework/defaults/views/dashboard/stores/auth.ts'), 'utf8')

  test('returns an operational error when authenticated roles cannot be resolved', () => {
    expect(action).toContain("dashboardOperationalError(error, 'Dashboard identity could not be loaded.', 'MeAction')")
    expect(action).not.toContain('roles: string[] = []')
  })

  test('fails role visibility closed until identity resolves successfully', () => {
    expect(store).toContain('const unauthenticated = state(false)')
    expect(store.match(/if \(!loaded\(\)\) return false/g)?.length).toBe(3)
    expect(store).toContain('roles.set([])')
    expect(store).toContain('unauthenticated.set(false)')
  })

  test('does not persist authorization state between dashboard sessions', () => {
    expect(store).toContain("pick: ['userId', 'userName', 'userEmail']")
    expect(store).not.toContain("'roles', 'unauthenticated'")
  })
})
