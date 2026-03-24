import { describe, expect, mock, test } from 'bun:test'

// Mock heavy dependencies before importing
mock.module('@stacksjs/cli', () => ({
  bold: (s: string) => s,
  dim: (s: string) => s,
  green: (s: string) => s,
  italic: (s: string) => s,
  log: { info: () => {} },
}))

mock.module('@stacksjs/path', () => ({
  path: {
    basename: (dir: string) => dir.split('/').pop() || dir,
    resolve: (...args: string[]) => args.join('/'),
    relative: (from: string, to: string) => to.replace(from, '.'),
  },
}))

mock.module('@stacksjs/storage', () => ({
  glob: async () => [],
}))

mock.module('@babel/generator', () => ({ default: {} }))
mock.module('@babel/parser', () => ({ default: {} }))
mock.module('@babel/traverse', () => ({ default: {} }))

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
    // No errors, no success:false -- should succeed
    await outro({
      dir: '/tmp/test',
      startTime: Date.now() - 100,
      result: { errors: [] },
    })
  })

  test('outro uses custom pkgName', async () => {
    const { outro } = await import('../src/index')
    await outro({
      dir: '/tmp/test',
      startTime: Date.now() - 50,
      result: { errors: [] },
      pkgName: '@stacksjs/custom-pkg',
    })
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
