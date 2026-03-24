import { describe, expect, test } from 'bun:test'

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
})
