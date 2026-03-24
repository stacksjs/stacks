import { describe, expect, mock, test } from 'bun:test'

// Mock the tinker dependency
mock.module('@stacksjs/tinker', () => ({
  startTinker: async () => ({ exitCode: 0 }),
  tinkerEval: async () => ({ exitCode: 0 }),
  tinkerPrint: async () => ({ exitCode: 0 }),
  getHistoryPath: () => '/tmp/.stacks_tinker_history',
  readHistory: () => [],
  appendHistory: () => {},
  clearHistory: () => {},
}))

describe('repl module', () => {
  test('startRepl is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.startRepl).toBe('function')
  })

  test('startTinker is re-exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.startTinker).toBe('function')
  })

  test('tinkerEval is re-exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.tinkerEval).toBe('function')
  })

  test('tinkerPrint is re-exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.tinkerPrint).toBe('function')
  })

  test('getHistoryPath is re-exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.getHistoryPath).toBe('function')
  })

  test('readHistory is re-exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.readHistory).toBe('function')
  })

  test('appendHistory is re-exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.appendHistory).toBe('function')
  })

  test('clearHistory is re-exported', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.clearHistory).toBe('function')
  })

  test('startRepl returns exitCode on default config', async () => {
    const { startRepl } = await import('../src/index')
    const result = await startRepl()
    expect(result).toBeDefined()
    expect(typeof result.exitCode).toBe('number')
  })

  test('ReplConfig extends TinkerConfig with loadFile', async () => {
    // Verify the function accepts ReplConfig-specific properties
    // Use a file that exists to avoid ENOENT noise
    const tmpFile = '/tmp/repl_test_loadfile.ts'
    const { writeFileSync, unlinkSync } = await import('node:fs')
    writeFileSync(tmpFile, 'const x = 1')
    try {
      const { startRepl } = await import('../src/index')
      const result = await startRepl({ loadFile: tmpFile })
      expect(result.exitCode).toBe(0)
    }
    finally {
      try { unlinkSync(tmpFile) } catch {}
    }
  })
})
