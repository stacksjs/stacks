import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const typesDir = join(import.meta.dir, '..', 'src')

describe('types module', () => {
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

  test('index re-exports build module', async () => {
    const indexContent = await Bun.file(join(typesDir, 'index.ts')).text()
    expect(indexContent).toContain("export * from './build'")
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
