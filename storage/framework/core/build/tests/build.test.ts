import { describe, expect, test } from 'bun:test'

describe('build module', () => {
  test('intro is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.intro).toBe('function')
  })

  test('outro is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.outro).toBe('function')
  })

  test('intro returns an object with startTime', async () => {
    const { intro } = await import('../src/index')
    const result = await intro({ dir: '/tmp/test', styled: false })
    expect(result).toBeDefined()
    expect(typeof result.startTime).toBe('number')
    expect(result.startTime).toBeGreaterThan(0)
  })

  test('intro uses custom pkgName when provided', async () => {
    const { intro } = await import('../src/index')
    const result = await intro({ dir: '/tmp/test', pkgName: '@stacksjs/custom', styled: false })
    expect(result.startTime).toBeGreaterThan(0)
  })

  test('outro throws on esbuild errors', async () => {
    const { outro } = await import('../src/index')
    const promise = outro({
      dir: '/tmp/test',
      startTime: Date.now(),
      result: { errors: ['something went wrong'] },
    })
    expect(promise).rejects.toThrow('Build failed with errors')
  })

  test('outro throws on Bun.build failure', async () => {
    const { outro } = await import('../src/index')
    const promise = outro({
      dir: '/tmp/test',
      startTime: Date.now(),
      result: { success: false, logs: ['Module not found'] },
    })
    expect(promise).rejects.toThrow('Build failed')
  })

  test('outro succeeds with passing esbuild result', async () => {
    const { outro } = await import('../src/index')
    const tmpDir = `/tmp/stacks-build-test-${Date.now()}`
    const fs = await import('node:fs')
    fs.mkdirSync(`${tmpDir}/dist`, { recursive: true })
    try {
      await outro({
        dir: tmpDir,
        startTime: Date.now() - 100,
        result: { errors: [] },
      })
    }
    finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('outro uses custom pkgName', async () => {
    const { outro } = await import('../src/index')
    const tmpDir = `/tmp/stacks-build-test-${Date.now()}`
    const fs = await import('node:fs')
    fs.mkdirSync(`${tmpDir}/dist`, { recursive: true })
    try {
      await outro({
        dir: tmpDir,
        startTime: Date.now() - 50,
        result: { errors: [] },
        pkgName: '@stacksjs/custom-pkg',
      })
    }
    finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('accepts valid declarations unchanged', async () => {
    const { validateDeclarations } = await import('../src/index')
    const tmpDir = `/tmp/stacks-build-declarations-${Date.now()}`
    const fs = await import('node:fs')
    fs.mkdirSync(`${tmpDir}/dist`, { recursive: true })
    const valid = `export declare const Arr: {\n  toArray: <T>(value: T) => T;\n}\ndeclare module 'pkg' {\n  interface Request extends Base {}\n}\n`
    fs.writeFileSync(`${tmpDir}/dist/index.d.ts`, valid)
    try {
      await validateDeclarations(tmpDir)
      // Valid files are left byte-for-byte intact — no repair pass exists.
      expect(fs.readFileSync(`${tmpDir}/dist/index.d.ts`, 'utf8')).toBe(valid)
    }
    finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('rejects declarations that remain invalid', async () => {
    const { validateDeclarations } = await import('../src/index')
    const tmpDir = `/tmp/stacks-build-invalid-declarations-${Date.now()}`
    const fs = await import('node:fs')
    fs.mkdirSync(`${tmpDir}/dist`, { recursive: true })
    fs.writeFileSync(`${tmpDir}/dist/index.d.ts`, 'export interface Broken { value: string value2: number }')
    try {
      expect(validateDeclarations(tmpDir)).rejects.toThrow('Invalid declaration generated')
    }
    finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('build utils', () => {
  test('generator is exported', async () => {
    const mod = await import('../src/utils')
    expect(mod).toHaveProperty('generator')
  })

  test('parser is exported', async () => {
    const mod = await import('../src/utils')
    expect(mod).toHaveProperty('parser')
  })

  test('traverse is exported', async () => {
    const mod = await import('../src/utils')
    expect(mod).toHaveProperty('traverse')
  })
})
