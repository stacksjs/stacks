import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

/**
 * `outro` reports at the level its caller asked for.
 *
 * `OutroOptions.type` has offered `'error' | 'warning' | 'success' | 'info'` for
 * as long as it has existed, and `outro` read only `'info'` - everything else
 * fell through to `log.success`. So a command that ended in failure and said so
 * through `type` still closed with a green line. `buddy seed` is the visible
 * case: 55 of 57 models seeded, exit code 1, and a SUCCESS line announcing the
 * two that failed, which is the line an operator scanning for red reads.
 */

const levels: string[] = []

function stubLogger() {
  levels.length = 0
  const record = (level: string) => (..._args: unknown[]) => { levels.push(level); return Promise.resolve() }
  return {
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    success: record('success'),
    debug: record('debug'),
    flush: () => Promise.resolve(),
  }
}

beforeEach(() => {
  mock.module('@stacksjs/logging', () => ({ log: stubLogger() }))
})

afterEach(() => {
  mock.restore()
})

async function outroWith(options: Record<string, unknown>): Promise<string[]> {
  const { outro } = await import('../src/helpers')
  levels.length = 0
  await outro('done', options as any)
  return [...levels]
}

describe('outro', () => {
  it('reports an error type through log.error', async () => {
    expect(await outroWith({ type: 'error' })).toContain('error')
  })

  it('reports a warning type through log.warn', async () => {
    expect(await outroWith({ type: 'warning' })).toContain('warn')
  })

  it('still reports success as success', async () => {
    expect(await outroWith({ type: 'success' })).toContain('success')
  })

  it('honours the type when a startTime is timing the run too', async () => {
    expect(await outroWith({ type: 'error', startTime: performance.now(), useSeconds: true })).toContain('error')
    expect(await outroWith({ type: 'warning', startTime: performance.now(), useSeconds: true })).toContain('warn')
  })
})
