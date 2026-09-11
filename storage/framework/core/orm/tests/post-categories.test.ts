import { expect, test } from 'bun:test'
import process from 'node:process'

test('Post eager-loads CMS categories, including when commerce is disabled', async () => {
  const child = Bun.spawn([
    process.execPath,
    `--config=${import.meta.dir}/../../router/tests/fixtures/cold-start.toml`,
    `${import.meta.dir}/fixtures/post-categories.ts`,
  ], {
    env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: ':memory:' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const timer = setTimeout(() => child.kill(), 10_000)
  try {
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect({ code, error: code === 0 ? '' : stderr }).toEqual({ code: 0, error: '' })
    expect(stdout).toContain('post categories: passed')
  }
  finally {
    clearTimeout(timer)
    child.kill()
  }
}, 15_000)
