import { describe, expect, it } from 'bun:test'

describe('published validation entrypoints', () => {
  it('imports narrow entries and shares the root schema binding', () => {
    const cwd = new URL('../', import.meta.url).pathname
    const build = Bun.spawnSync({ cmd: [process.execPath, 'build.ts'], cwd, stdout: 'pipe', stderr: 'pipe' })
    expect(build.exitCode, build.stderr.toString()).toBe(0)
    const probe = Bun.spawnSync({
      cmd: [process.execPath, '--tsconfig-override=' + new URL('../../tsconfig.build.json', import.meta.url).pathname, '-e', `
        const root = await import('./dist/index.js')
        const runtime = await import('./dist/runtime.js')
        const request = await import('./dist/request-validator.js')
        const source = await import('./src/schema.ts')
        if (root.schema !== runtime.schema) throw new Error('Schema binding differs between entries')
        const value = await request.validate({ count: 2 }, { count: runtime.schema.number() })
        if (value.count !== 2) throw new Error('Published request validation failed')
        // Vendored apps can mix published and source schema instances.
        // Both directions must retain nested projections without revalidation.
        for (const [outer, inner] of [[root.schema, source.schema], [source.schema, root.schema]]) {
          let calls = 0
          const child = inner.object({ name: inner.string().custom(() => { calls++; return true }, 'unused') })
          const clean = await request.validate({ items: [{ name: 'Alice', isAdmin: true }] }, { items: outer.array().each(child) })
          if (JSON.stringify(clean) !== '{"items":[{"name":"Alice"}]}' || calls !== 1) throw new Error('Mixed schema projection failed')
        }
      `],
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(probe.exitCode, probe.stderr.toString()).toBe(0)
  }, 30000)
})
