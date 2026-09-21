import { describe, expect, it, spyOn } from 'bun:test'
import { withTimeout } from '../src/lazy-commands'

describe('lazy command timeout', () => {
  it('clears the deadline when work settles first', async () => {
    const clearTimeoutSpy = spyOn(globalThis, 'clearTimeout')

    try {
      await expect(withTimeout(Promise.resolve('loaded'), 5000)).resolves.toBe('loaded')
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
    }
    finally {
      clearTimeoutSpy.mockRestore()
    }
  })

  it('still rejects work that exceeds its deadline', async () => {
    const stalled = new Promise<never>(() => {})

    await expect(withTimeout(stalled, 5)).rejects.toThrow('timeout')
  })
})
