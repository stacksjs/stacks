import { describe, expect, it } from 'bun:test'

describe('published validation entrypoints', () => {
  it('imports narrow entries and shares the root schema binding', () => {
    const cwd = new URL('../', import.meta.url).pathname
    const build = Bun.spawnSync({ cmd: [process.execPath, 'build.ts'], cwd, stdout: 'pipe', stderr: 'pipe' })
    expect(build.exitCode, build.stderr.toString()).toBe(0)
    const probe = Bun.spawnSync({
      cmd: [process.execPath, '-e', `
        const root = await import('./dist/index.js')
        const runtime = await import('./dist/runtime.js')
        const request = await import('./dist/request-validator.js')
        if (root.schema !== runtime.schema) throw new Error('Schema binding differs between entries')
        const value = await request.validate({ count: 2 }, { count: runtime.schema.number() })
        if (value.count !== 2) throw new Error('Published request validation failed')
      `],
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(probe.exitCode, probe.stderr.toString()).toBe(0)
  }, 30000)
})
