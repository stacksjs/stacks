import { describe, expect, it, spyOn } from 'bun:test'
import { getCommandsToLoad, withTimeout } from '../src/lazy-commands'

describe('lazy command timeout', () => {
  it('selects setup only for its own commands, including the ensure alias', () => {
    expect(getCommandsToLoad(['release', '--bump', 'patch'])).toEqual(['release'])
    expect(getCommandsToLoad(['ensure'])).toEqual(['ensure'])
    expect(getCommandsToLoad(['setup:ai'])).toEqual(['setup:ai'])
    expect(getCommandsToLoad(['ai:setup'])).toEqual(['ai:setup'])
    expect(getCommandsToLoad(['--help'])).toContain('setup')
  })

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
