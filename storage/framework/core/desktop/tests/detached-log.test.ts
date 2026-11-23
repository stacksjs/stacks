import { afterEach, describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { logToFileWhenDetached } from '../src/agent-launcher'

// stacksjs/stacks#3371. A desktop app launched from Finder writes its console
// to ~/Library/Logs/<App>.log. That file was created world-readable, never
// rotated, and recorded the window's `?session=` URL as Craft echoed it,
// whose token is the session cookie itself: anyone who could read the log
// could drive the app's local agent for as long as it ran.

const levels = ['log', 'info', 'warn', 'error', 'debug'] as const
const saved = Object.fromEntries(levels.map(level => [level, console[level]]))
let directory = ''

afterEach(() => {
  for (const level of levels) console[level] = saved[level]!
  if (directory) rmSync(directory, { recursive: true, force: true })
})

function logFile(): string {
  directory = mkdtempSync(join(tmpdir(), 'stacks-detached-log-'))
  return join(directory, 'Logs', 'Example.log')
}

describe('the detached desktop log', () => {
  test('is readable by its owner only', () => {
    const file = logFile()
    expect(logToFileWhenDetached(file, false)).toBe(true)
    console.log('serving on http://127.0.0.1:5000')
    expect(statSync(file).mode & 0o777).toBe(0o600)
  })

  test('an existing log made readable by others is narrowed', () => {
    const file = logFile()
    logToFileWhenDetached(file, false)
    console.log('first line')
    for (const level of levels) console[level] = saved[level]!
    chmodSync(file, 0o644)
    logToFileWhenDetached(file, false)
    console.log('second line')
    expect(statSync(file).mode & 0o777).toBe(0o600)
  })

  test('never records a session token', () => {
    const file = logFile()
    logToFileWhenDetached(file, false)
    console.error('[craft] loading http://127.0.0.1:5000/?session=3f9c0a77b1&next=/inbox')
    console.log({ url: 'http://127.0.0.1:5000/dashboard?tab=1&session=deadbeef' })
    const text = readFileSync(file, 'utf8')
    expect(text).not.toContain('3f9c0a77b1')
    expect(text).not.toContain('deadbeef')
    expect(text).toContain('session=[redacted]&next=/inbox')
    expect(text).toContain('tab=1&session=[redacted]')
  })

  test('rotates past its size limit, keeping one previous file', () => {
    const file = logFile()
    logToFileWhenDetached(file, false, { maxBytes: 200 })
    for (let i = 0; i < 20; i++) console.log(`line ${i} ${'x'.repeat(20)}`)
    expect(existsSync(`${file}.1`)).toBe(true)
    expect(statSync(file).size).toBeLessThanOrEqual(200)
    expect(statSync(`${file}.1`).mode & 0o777).toBe(0o600)
    expect(readFileSync(file, 'utf8')).toContain('line 19')
  })

  test('a log already past the limit at launch is rotated first', () => {
    const file = logFile()
    logToFileWhenDetached(file, false)
    for (const level of levels) console[level] = saved[level]!
    writeFileSync(file, 'y'.repeat(500))
    logToFileWhenDetached(file, false, { maxBytes: 200 })
    console.log('after launch')
    expect(readFileSync(`${file}.1`, 'utf8')).toBe('y'.repeat(500))
    expect(readFileSync(file, 'utf8')).toContain('after launch')
  })

  test('a terminal keeps its output', () => {
    expect(logToFileWhenDetached(logFile(), true)).toBe(false)
  })
})
