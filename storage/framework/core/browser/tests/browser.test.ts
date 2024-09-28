import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as browser from '../src'
import { debounce } from '../src/utils/debounce'

describe('@stacksjs/browser', () => {
  describe('base', () => {
    it('loop function works correctly', async () => {
      const results: number[] = []
      await browser.loop(3, (i: number) => results.push(i))
      expect(results).toEqual([0, 1, 2])
    })
  })

  describe('debounce', () => {
    let originalSetTimeout: typeof setTimeout
    let originalClearTimeout: typeof clearTimeout
    let mockTime: number
    let timeoutCallbacks: Array<{ callback: Function; delay: number }>

    beforeEach(() => {
      mockTime = 0
      timeoutCallbacks = []
      originalSetTimeout = globalThis.setTimeout
      originalClearTimeout = globalThis.clearTimeout

      globalThis.setTimeout = ((callback: Function, delay: number) => {
        timeoutCallbacks.push({ callback, delay })
        return timeoutCallbacks.length
      }) as any

      globalThis.clearTimeout = (id: string | number | NodeJS.Timeout | Timer | undefined) => {
        if (typeof id === 'number') {
          timeoutCallbacks.splice(id - 1, 1)
        }
      }
    })

    afterEach(() => {
      globalThis.setTimeout = originalSetTimeout
      globalThis.clearTimeout = originalClearTimeout
    })

    function advanceTimersByTime(ms: number) {
      mockTime += ms
      timeoutCallbacks.filter(({ delay }) => delay <= mockTime).forEach(({ callback }) => callback())
      timeoutCallbacks = timeoutCallbacks.filter(({ delay }) => delay > mockTime)
    }

    it('should debounce function calls', async () => {
      const fn = () => {}
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      advanceTimersByTime(99)
      expect(timeoutCallbacks.length).toBe(1)

      advanceTimersByTime(1)
      expect(timeoutCallbacks.length).toBe(0)
    })

    it('should pass arguments to the debounced function', async () => {
      let lastArgs: any[]
      const fn = (...args: any[]) => {
        lastArgs = args
      }
      const debouncedFn = debounce(fn, 100)

      debouncedFn(1, 'a')
      debouncedFn(2, 'b')
      debouncedFn(3, 'c')

      advanceTimersByTime(100)
      // @ts-expect-error it is defined
      expect(lastArgs).toEqual([3, 'c'])
    })

    it('should return a promise that resolves after the debounce period', async () => {
      const fn = () => 'result'
      const debouncedFn = debounce(fn, 100)

      const promise = debouncedFn()

      advanceTimersByTime(100)
      const result = await promise

      expect(result).toBe('result')
    })
  })

  describe('function', () => {
    it('batchInvoke calls all functions', () => {
      const fn1 = mock()
      const fn2 = mock()
      browser.batchInvoke([fn1, fn2])
      expect(fn1).toHaveBeenCalled()
      expect(fn2).toHaveBeenCalled()
    })

    it('tap returns the value after callback', () => {
      const obj = { count: 0 }
      const result = browser.tap(obj, (o) => {
        o.count++
      })
      expect(result).toBe(obj)
      expect(result.count).toBe(1)
    })
  })

  describe('guards', () => {
    it('notNullish correctly filters values', () => {
      expect(browser.notNullish(0)).toBe(true)
      expect(browser.notNullish('')).toBe(true)
      expect(browser.notNullish(null)).toBe(false)
      expect(browser.notNullish(undefined)).toBe(false)
    })

    it('isTruthy correctly identifies truthy values', () => {
      expect(browser.isTruthy(1)).toBe(true)
      expect(browser.isTruthy('a')).toBe(true)
      expect(browser.isTruthy(false)).toBe(false)
      expect(browser.isTruthy(0)).toBe(false)
    })

    it('noNull correctly filters null values', () => {
      expect(browser.noNull(0)).toBe(true)
      expect(browser.noNull('')).toBe(true)
      expect(browser.noNull(null)).toBe(false)
      expect(browser.noNull(undefined)).toBe(true)
    })

    it('notUndefined correctly filters undefined values', () => {
      expect(browser.notUndefined(0)).toBe(true)
      expect(browser.notUndefined('')).toBe(true)
      expect(browser.notUndefined(null)).toBe(true)
      expect(browser.notUndefined(undefined)).toBe(false)
    })
  })

  describe('math', () => {
    it('clamp function works correctly', () => {
      expect(browser.clamp(5, 0, 10)).toBe(5)
      expect(browser.clamp(-1, 0, 10)).toBe(0)
      expect(browser.clamp(11, 0, 10)).toBe(10)
    })

    it('rand function returns number within range', () => {
      const result = browser.rand(1, 10)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(10)
    })
  })

  describe('promise', () => {
    it('createSingletonPromise returns same promise on multiple calls', async () => {
      let count = 0
      const fn = browser.createSingletonPromise(() => Promise.resolve(++count))
      const [result1, result2] = await Promise.all([fn(), fn()])
      expect(result1).toBe(1)
      expect(result2).toBe(1)
    })

    it('createPromiseLock runs tasks sequentially', async () => {
      const lock = browser.createPromiseLock()
      const results: number[] = []
      await Promise.all([
        lock.run(
          () =>
            new Promise((resolve) =>
              setTimeout(() => {
                results.push(1)
                resolve()
              }, 50),
            ) as Promise<void>,
        ),
        lock.run(
          () =>
            new Promise((resolve) =>
              setTimeout(() => {
                results.push(2)
                resolve()
              }, 10),
            ) as Promise<void>,
        ),
      ])
      expect(results.length).toBe(2)
      expect(results).toContain(1)
      expect(results).toContain(2)
    })

    it('createControlledPromise resolves correctly', async () => {
      const controlledPromise = browser.createControlledPromise<string>()
      setTimeout(() => controlledPromise.resolve('test'), 10)
      const result = await controlledPromise
      expect(result).toBe('test')
    })
  })

  describe('retry', () => {
    let mockFn
    let mockOptions: any
    let originalSetTimeout: typeof setTimeout

    beforeEach(() => {
      mockFn = mock(() => {})
      mockOptions = {
        retries: 3,
        initialDelay: 100,
        backoffFactor: 2,
        jitter: true,
      }
      originalSetTimeout = global.setTimeout
      global.setTimeout = ((cb: Function) => cb()) as any
    })

    afterEach(() => {
      global.setTimeout = originalSetTimeout
      mock.restore()
    })

    it('should resolve immediately if the function succeeds on first try', async () => {
      mockFn.mockResolvedValue('success')
      const result = await browser.retry(mockFn, mockOptions)
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should retry specified number of times before failing', async () => {
      mockFn.mockRejectedValue(new Error('fail'))
      await expect(browser.retry(mockFn, mockOptions)).rejects.toThrow('fail')
      expect(mockFn).toHaveBeenCalledTimes(4) // Initial + 3 retries
    })

    it('should succeed if function succeeds on last retry', async () => {
      mockFn
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success')
      const result = await browser.retry(mockFn, mockOptions)
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(4)
    })

    it('should use default options if not provided', async () => {
      mockFn.mockRejectedValue(new Error('fail'))
      await expect(browser.retry(mockFn, {})).rejects.toThrow('fail')
      expect(mockFn).toHaveBeenCalledTimes(4) // Default 3 retries + initial attempt
    })

    it('should respect custom retry count', async () => {
      mockFn.mockRejectedValue(new Error('fail'))
      await expect(browser.retry(mockFn, { retries: 5 })).rejects.toThrow('fail')
      expect(mockFn).toHaveBeenCalledTimes(6) // 5 retries + initial attempt
    })

    it('should pass arguments to the retried function', async () => {
      const mockFnWithArgs = mock((a: number, b: string) => Promise.resolve(`${a}-${b}`))
      mockFnWithArgs.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('1-test')

      const result = await browser.retry(() => mockFnWithArgs(1, 'test'), mockOptions)
      expect(result).toBe('1-test')
      expect(mockFnWithArgs).toHaveBeenCalledWith(1, 'test')
    })
  })

  describe('calculateDelay', () => {
    it('should calculate delay correctly without jitter', () => {
      const delay = browser.calculateDelay(0, 100, 2, false)
      expect(delay).toBe(100)

      const delay2 = browser.calculateDelay(1, 100, 2, false)
      expect(delay2).toBe(200)

      const delay3 = browser.calculateDelay(2, 100, 2, false)
      expect(delay3).toBe(400)
    })

    it('should apply jitter when enabled', () => {
      const delay = browser.calculateDelay(0, 100, 2, true)
      expect(delay).toBeGreaterThan(70) // 100 - 30% jitter
      expect(delay).toBeLessThan(130) // 100 + 30% jitter

      const delay2 = browser.calculateDelay(1, 100, 2, true)
      expect(delay2).toBeGreaterThan(140) // 200 - 30% jitter
      expect(delay2).toBeLessThan(260) // 200 + 30% jitter
    })

    it('should handle edge cases', () => {
      expect(browser.calculateDelay(0, 0, 2, false)).toBe(0)
      expect(browser.calculateDelay(0, 100, 1, false)).toBe(100)
      expect(browser.calculateDelay(10, 1, 1.5, false)).toBeCloseTo(57.665, 3)
    })
  })

  describe('sleep', () => {
    it('sleep function pauses execution', async () => {
      const start = Date.now()
      await browser.sleep(100)
      const duration = Date.now() - start
      expect(duration).toBeGreaterThanOrEqual(95) // Allow for small timing variations
    })

    it('wait function pauses execution', async () => {
      const start = Date.now()
      await browser.wait(100)
      const duration = Date.now() - start
      expect(duration).toBeGreaterThanOrEqual(95)
    })

    it('delay function pauses execution', async () => {
      const start = Date.now()
      await browser.delay(100)
      const duration = Date.now() - start
      expect(duration).toBeGreaterThanOrEqual(95)
    })
  })

  describe('throttle', () => {
    it('throttle function limits call frequency', async () => {
      let callCount = 0
      const throttledFn = browser.throttle(() => {
        callCount++
      }, 100)

      throttledFn()
      throttledFn()
      throttledFn()

      expect(callCount).toBe(1)

      await browser.sleep(150)
      throttledFn()
      expect(callCount).toBe(2)
    })
  })

  describe('regex', () => {
    it('createRegExp creates a valid regex', () => {
      const regex = browser.createRegExp('test')
      expect(regex.test('This is a test')).toBe(true)
      expect(regex.test('This is not a match')).toBe(false)
    })

    it('caseInsensitive flag creates case-insensitive regex', () => {
      const regex = browser.createRegExp('test', { flags: 'i' })
      expect(regex.test('This is a TEST')).toBe(true)
      expect(regex.test('This is a test')).toBe(true)
      expect(regex.test('This is not a match')).toBe(false)
    })

    it('global flag matches all occurrences', () => {
      const regex = browser.createRegExp('a', { flags: 'g' })
      const matches = 'banana'.match(regex)
      expect(matches).toHaveLength(3)
    })

    it('multiline flag respects line boundaries', () => {
      const regex = browser.createRegExp('^test', { flags: 'm' })
      expect(regex.test('test\ntest')).toBe(true)
      expect(regex.test('not\ntest')).toBe(true)
    })

    it('combines multiple flags', () => {
      const regex = browser.createRegExp('a', { flags: 'gi' })
      const matches = 'bAnAnA'.match(regex)
      expect(matches).toHaveLength(3)
    })

    it('handles special characters', () => {
      const regex = browser.createRegExp('\\d+')
      expect(regex.test('123')).toBe(true)
      expect(regex.test('abc')).toBe(false)
    })

    it('works with character classes', () => {
      const regex = browser.createRegExp('[aeiou]')
      expect(regex.test('hello')).toBe(true)
      expect(regex.test('rhythm')).toBe(false)
    })

    it('supports quantifiers', () => {
      const regex = browser.createRegExp('a{2,4}')
      expect(regex.test('aa')).toBe(true)
      expect(regex.test('aaaa')).toBe(true)
      expect(regex.test('a')).toBe(false)
      expect(regex.test('aaaaa')).toBe(true) // Matches first 4 'a's
    })

    it('handles alternation', () => {
      const regex = browser.createRegExp('cat|dog')
      expect(regex.test('I have a cat')).toBe(true)
      expect(regex.test('I have a dog')).toBe(true)
      expect(regex.test('I have a bird')).toBe(false)
    })

    it('supports capturing groups', () => {
      const regex = browser.createRegExp('(\\w+)\\s(\\w+)')
      const match = 'John Doe'.match(regex)
      expect(match?.[1]).toBe('John')
      expect(match?.[2]).toBe('Doe')
    })

    it('works with lookahead assertions', () => {
      const regex = browser.createRegExp('\\w+(?=\\s)')
      const match = 'John Doe'.match(regex)
      expect(match?.[0]).toBe('John')
    })

    it('handles negative lookahead assertions', () => {
      const regex = browser.createRegExp('\\w+(?!ing)\\b', { flags: 'g' })
      const text = 'Singing running eating'
      const matches = text.match(regex)
      expect(matches).toEqual(['Singing', 'running', 'eating'])
    })
  })

  describe('vendors', () => {
    it('useToggle function toggles boolean value', () => {
      const [value, toggle] = browser.useToggle(false)
      expect(value.value).toBe(false)
      toggle()
      expect(value.value).toBe(true)
    })

    it('useDark function toggles dark mode', () => {
      const isDark = browser.useDark()
      expect(typeof isDark.value).toBe('boolean')
    })
  })
})
