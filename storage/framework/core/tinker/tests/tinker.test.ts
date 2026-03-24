import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

describe('tinker module exports', () => {
  test('startTinker is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.startTinker).toBe('function')
  })

  test('tinkerEval is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.tinkerEval).toBe('function')
  })

  test('tinkerPrint is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.tinkerPrint).toBe('function')
  })

  test('getHistoryPath is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.getHistoryPath).toBe('function')
  })

  test('readHistory is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.readHistory).toBe('function')
  })

  test('appendHistory is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.appendHistory).toBe('function')
  })

  test('clearHistory is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.clearHistory).toBe('function')
  })
})

describe('getHistoryPath', () => {
  test('returns default path in home directory', async () => {
    const { getHistoryPath } = await import('../src/index')
    const path = getHistoryPath()
    expect(path).toBe(join(homedir(), '.stacks_tinker_history'))
  })

  test('uses custom historyFile when provided', async () => {
    const { getHistoryPath } = await import('../src/index')
    const path = getHistoryPath({ historyFile: '/tmp/custom_history' })
    expect(path).toBe('/tmp/custom_history')
  })
})

describe('readHistory', () => {
  test('returns empty array when history file does not exist', async () => {
    const { readHistory } = await import('../src/index')
    const history = readHistory({ historyFile: '/tmp/nonexistent_tinker_history_test' })
    expect(history).toEqual([])
  })

  test('reads entries from existing history file', async () => {
    const { readHistory } = await import('../src/index')
    const testFile = '/tmp/tinker_test_read_history'
    writeFileSync(testFile, 'line1\nline2\nline3\n')

    try {
      const history = readHistory({ historyFile: testFile })
      expect(history).toEqual(['line1', 'line2', 'line3'])
    }
    finally {
      unlinkSync(testFile)
    }
  })

  test('filters empty lines', async () => {
    const { readHistory } = await import('../src/index')
    const testFile = '/tmp/tinker_test_read_history_empty'
    writeFileSync(testFile, 'line1\n\nline2\n\n')

    try {
      const history = readHistory({ historyFile: testFile })
      expect(history).toEqual(['line1', 'line2'])
    }
    finally {
      unlinkSync(testFile)
    }
  })
})

describe('appendHistory', () => {
  const testFile = '/tmp/tinker_test_append_history'

  afterEach(() => {
    try { unlinkSync(testFile) } catch {}
  })

  test('creates file and appends entry', async () => {
    const { appendHistory, readHistory } = await import('../src/index')
    appendHistory('test entry', { historyFile: testFile })
    const history = readHistory({ historyFile: testFile })
    expect(history).toContain('test entry')
  })

  test('appends multiple entries', async () => {
    const { appendHistory, readHistory } = await import('../src/index')
    appendHistory('entry1', { historyFile: testFile })
    appendHistory('entry2', { historyFile: testFile })
    const history = readHistory({ historyFile: testFile })
    expect(history).toContain('entry1')
    expect(history).toContain('entry2')
  })
})

describe('clearHistory', () => {
  test('clears the history file', async () => {
    const { appendHistory, clearHistory, readHistory } = await import('../src/index')
    const testFile = '/tmp/tinker_test_clear_history'

    try {
      appendHistory('something', { historyFile: testFile })
      clearHistory({ historyFile: testFile })
      const history = readHistory({ historyFile: testFile })
      expect(history).toEqual([])
    }
    finally {
      try { unlinkSync(testFile) } catch {}
    }
  })
})
