import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { privateTenantFiles, resolvePrivateTenants } from '../src/cloud-tenants'

let root: string

beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'tenants-')) })
afterEach(() => { rmSync(root, { recursive: true, force: true }) })

function write(path: string, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, body)
}

describe('private tenant list', () => {
  it('reads nothing from an empty machine', () => {
    expect(resolvePrivateTenants({ env: {}, cwd: root, home: root })).toEqual([])
  })

  it('merges environment, files and declared config without duplicates', () => {
    write(join(root, 'home/.config/stacks/tenants.json'), JSON.stringify({ tenants: ['alpha', 'beta'] }))
    write(join(root, 'app/storage/cloud/tenants.json'), JSON.stringify(['beta', 'gamma']))
    const found = resolvePrivateTenants({
      env: { STACKS_CLOUD_TENANTS: 'delta, Epsilon' },
      cwd: join(root, 'app'),
      home: join(root, 'home'),
      declared: ['zeta'],
    })
    expect(found).toEqual(['alpha', 'beta', 'delta', 'epsilon', 'gamma', 'zeta'])
  })

  it('prefers the explicit private directory as an additional source', () => {
    write(join(root, 'private/tenants.json'), JSON.stringify(['kept']))
    const options = { env: { STACKS_PRIVATE_DIR: join(root, 'private') }, cwd: root, home: root }
    expect(privateTenantFiles(options)[0]).toBe(join(root, 'private', 'tenants.json'))
    expect(resolvePrivateTenants(options)).toEqual(['kept'])
  })

  it('ignores malformed files and invalid slugs instead of failing a deploy', () => {
    write(join(root, 'storage/cloud/tenants.json'), '{ not json')
    expect(resolvePrivateTenants({ env: { STACKS_CLOUD_TENANTS: 'ok,bad_slug!,../etc' }, cwd: root, home: root })).toEqual(['ok'])
  })
})
