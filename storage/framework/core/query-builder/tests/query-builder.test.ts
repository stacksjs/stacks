import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

describe('query-builder module', () => {
  test('module re-exports from bun-query-builder', async () => {
    const mod = await import('../src/index')
    expect(mod).toBeDefined()
  })

  test('QueryBuilder alias is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.QueryBuilder).toBeDefined()
    expect(typeof mod.QueryBuilder).toBe('function')
  })

  test('createQueryBuilder is exported via re-export', async () => {
    const mod = await import('../src/index')
    expect(mod.createQueryBuilder).toBeDefined()
    expect(typeof mod.createQueryBuilder).toBe('function')
  })

  test('saveMigrationSnapshot is exported for framework-owned writers', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.saveMigrationSnapshot).toBe('function')
  })

  test('QueryBuilder and createQueryBuilder reference the same function', async () => {
    const mod = await import('../src/index')
    expect(mod.QueryBuilder).toBe(mod.createQueryBuilder)
  })

  test('persistent hooks restore the no-hooks fast path when removed', async () => {
    const child = Bun.spawn([process.execPath, join(import.meta.dir, 'fixtures/query-hook-lifecycle.ts')], {
      cwd: join(import.meta.dir, '..'),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(exitCode, stderr).toBe(0)
    expect(stdout).toContain('query-hook-lifecycle-ok')
  })
})
