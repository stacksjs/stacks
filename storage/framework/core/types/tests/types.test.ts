import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const typesDir = join(import.meta.dir, '..', 'src')

describe('types module', () => {
  test('UiConfig types the actual frontend config and Stacks default view selection', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-ui-config-'))
    try {
      const file = join(directory, 'config.ts')
      await writeFile(file, `
        import type { UiConfig } from ${JSON.stringify(join(typesDir, 'ui'))}
        const config = {
          root: 'resources', stateDir: 'storage/framework/stx',
          plugins: ['@stacksjs/components', ['./plugin.ts', { enabled: true }]],
          app: { head: { title: 'A native Stacks application' } },
          defaultViews: ['errors'], imageWarmup: 'auto', imageWarmupBindBudgetMs: 0,
        } satisfies UiConfig
        // @ts-expect-error A state directory must be a path.
        const invalidRoot = { stateDir: false } satisfies UiConfig
        // @ts-expect-error Plugin entries must follow the engine's contract.
        const invalidPlugin = { plugins: [42] } satisfies UiConfig
        // @ts-expect-error The engine accepts boolean or 'auto' image warm-up.
        const invalidWarmup = { imageWarmup: 'disabled' } satisfies UiConfig
        // @ts-expect-error A bind budget is numeric.
        const invalidBudget = { imageWarmupBindBudgetMs: 'slow' } satisfies UiConfig
        // @ts-expect-error Framework default views are a boolean or a subtree list.
        const invalidViews = { defaultViews: 'all' } satisfies UiConfig
        void [config, invalidRoot, invalidPlugin, invalidWarmup, invalidBudget, invalidViews]
      `)
      const child = Bun.spawn([process.execPath, '--bun', 'tsc', '--ignoreConfig', '--noEmit', '--module', 'ESNext', '--target', 'ESNext', '--moduleResolution', 'bundler', '--types', 'bun', '--skipLibCheck', file], {
        cwd: join(typesDir, '../../../../..'), stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(4000),
      })
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `TypeScript exit ${code}: ${stdout}${stderr}`).toBe(0)
    }
    finally { await rm(directory, { recursive: true, force: true }) }
  })

  test('types index file exists', () => {
    expect(existsSync(join(typesDir, 'index.ts'))).toBe(true)
  })

  test('ai types file exists', () => {
    expect(existsSync(join(typesDir, 'ai.ts'))).toBe(true)
  })

  test('app types file exists', () => {
    expect(existsSync(join(typesDir, 'app.ts'))).toBe(true)
  })

  test('database types file exists', () => {
    expect(existsSync(join(typesDir, 'database.ts'))).toBe(true)
  })

  test('server types file exists', () => {
    expect(existsSync(join(typesDir, 'server.ts'))).toBe(true)
  })

  test('errors types file exists', () => {
    expect(existsSync(join(typesDir, 'errors.ts'))).toBe(true)
  })

  test('deploy types file exists', () => {
    expect(existsSync(join(typesDir, 'deploy.ts'))).toBe(true)
  })

  test('model types file exists', () => {
    expect(existsSync(join(typesDir, 'model.ts'))).toBe(true)
  })

  test('auth types file exists', () => {
    expect(existsSync(join(typesDir, 'auth.ts'))).toBe(true)
  })

  test('cli types file exists', () => {
    expect(existsSync(join(typesDir, 'cli.ts'))).toBe(true)
  })

  test('cloud types file exists', () => {
    expect(existsSync(join(typesDir, 'cloud.ts'))).toBe(true)
  })

  test('cache types file exists', () => {
    expect(existsSync(join(typesDir, 'cache.ts'))).toBe(true)
  })

  test('email types file exists', () => {
    expect(existsSync(join(typesDir, 'email.ts'))).toBe(true)
  })

  test('events types file exists', () => {
    expect(existsSync(join(typesDir, 'events.ts'))).toBe(true)
  })

  test('router types file exists', () => {
    expect(existsSync(join(typesDir, 'router.ts'))).toBe(true)
  })

  test('ui types file exists', () => {
    expect(existsSync(join(typesDir, 'ui.ts'))).toBe(true)
  })
})

describe('types index re-exports', () => {
  test('index re-exports ai module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './ai'")
  })

  test('index re-exports app module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './app'")
  })

  test('index re-exports database module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './database'")
  })

  test('index re-exports server module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './server'")
  })

  test('index re-exports errors module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './errors'")
  })

  test('index re-exports auth module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './auth'")
  })

  test('index re-exports model module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './model'")
  })

  test('index does NOT re-export the vite-era modules', async () => {
    // `./build` (and `./inspect`, `./pwa`, `./ssg`, `./layout`) were removed
    // deliberately: they exposed `vite` / `vite-ssg` types, and Stacks builds
    // with Bun. This asserts the removal so the barrel can't quietly regain a
    // vite dependency — it replaces a test that still required `./build`.
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    for (const mod of ['build', 'inspect', 'pwa', 'ssg', 'layout'])
      expect(indexContent).not.toContain(`export * from './${mod}'`)
  })

  test('index re-exports deploy module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './deploy'")
  })

  test('index re-exports router module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './router'")
  })

  test('index re-exports cloud module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './cloud'")
  })

  test('index re-exports ui module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './ui'")
  })

  test('index contains at least 40 re-exports', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    const reExportCount = (indexContent.match(/export \* from/g) || []).length
    expect(reExportCount).toBeGreaterThanOrEqual(40)
  })
})
