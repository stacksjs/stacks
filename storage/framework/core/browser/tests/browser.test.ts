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
    // eslint-disable-next-line ts/no-unsafe-function-type
    let timeoutCallbacks: Array<{ callback: Function, delay: number }>

    beforeEach(() => {
      mockTime = 0
      timeoutCallbacks = []
      originalSetTimeout = globalThis.setTimeout
      originalClearTimeout = globalThis.clearTimeout

      // eslint-disable-next-line ts/no-unsafe-function-type
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
    describe('createSingletonPromise', () => {
      it('returns same promise on multiple calls', async () => {
        let count = 0
        const fn = browser.createSingletonPromise(() => Promise.resolve(++count))
        const [result1, result2] = await Promise.all([fn(), fn()])
        expect(result1).toBe(1)
        expect(result2).toBe(1)
      })

      it('resets the promise when reset is called', async () => {
        let count = 0
        const fn = browser.createSingletonPromise(() => Promise.resolve(++count))
        const result1 = await fn()
        await fn.reset()
        const result2 = await fn()
        expect(result1).toBe(1)
        expect(result2).toBe(2)
      })

      it('handles rejections correctly', async () => {
        const fn = browser.createSingletonPromise(() => Promise.reject(new Error('test error')))
        expect(fn()).rejects.toThrow('test error')
      })
    })

    describe('createPromiseLock', () => {
      it('runs tasks sequentially', async () => {
        const lock = browser.createPromiseLock()
        const results: number[] = []
        await lock.run(async () => {
          await browser.sleep(50)
          results.push(1)
        })
        await lock.run(async () => {
          await browser.sleep(10)
          results.push(2)
        })
        expect(results).toEqual([1, 2])
      })

      it('waits for all tasks to complete in correct order', async () => {
        const lock = browser.createPromiseLock()
        const results: number[] = []
        let resolve1: () => void
        let resolve2: () => void

        // console.log('Test started')

        const promise1 = new Promise<void>((r) => {
          resolve1 = r
        })
        const promise2 = new Promise<void>((r) => {
          resolve2 = r
        })

        lock.run(async () => {
          // console.log('Task 1 started')
          await promise1
          results.push(1)
          // console.log('Task 1 completed')
        })

        lock.run(async () => {
          // console.log('Task 2 started')
          await promise2
          results.push(2)
          // console.log('Task 2 completed')
        })

        // console.log('Resolving promise 2')
        resolve2!()
        await browser.sleep(10)
        // console.log('Resolving promise 1')
        resolve1!()

        // console.log('Waiting for lock')
        await lock.wait()
        // console.log('Lock wait completed')

        // console.log('Final results:', results)
        expect(results).toEqual([1, 2])
      })

      it('reports waiting status correctly', async () => {
        const lock = browser.createPromiseLock()
        expect(lock.isWaiting()).toBe(false)
        const promise = lock.run(() => new Promise<void>(resolve => setTimeout(resolve, 50)))
        expect(lock.isWaiting()).toBe(true)
        await promise
        expect(lock.isWaiting()).toBe(false)
      })

      it('clears all pending tasks', async () => {
        const lock = browser.createPromiseLock()
        lock.run(() => new Promise<void>(resolve => setTimeout(resolve, 50)))
        lock.run(() => new Promise<void>(resolve => setTimeout(resolve, 100)))
        expect(lock.isWaiting()).toBe(true)
        lock.clear()
        expect(lock.isWaiting()).toBe(false)
      })
    })

    describe('createControlledPromise', () => {
      it('resolves correctly', async () => {
        const controlledPromise = browser.createControlledPromise<string>()
        setTimeout(() => controlledPromise.resolve('test'), 10)
        const result = await controlledPromise
        expect(result).toBe('test')
      })

      it('rejects correctly', async () => {
        const controlledPromise = browser.createControlledPromise<string>()
        setTimeout(() => controlledPromise.reject(new Error('test error')), 10)
        expect(controlledPromise).rejects.toThrow('test error')
      })

      it('can be resolved externally', async () => {
        const controlledPromise = browser.createControlledPromise<number>()
        controlledPromise.resolve(42)
        const result = await controlledPromise
        expect(result).toBe(42)
      })

      it('can be rejected externally', async () => {
        const controlledPromise = browser.createControlledPromise<number>()
        controlledPromise.reject(new Error('external rejection'))
        expect(controlledPromise).rejects.toThrow('external rejection')
      })
    })
  })

  describe('retry', () => {
    // eslint-disable-next-line unused-imports/no-unused-vars
    const dummy = mock()
    type Mock = typeof dummy
    let mockFn: Mock
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
      originalSetTimeout = globalThis.setTimeout
      // eslint-disable-next-line ts/no-unsafe-function-type
      globalThis.setTimeout = ((cb: Function) => cb()) as any
    })

    afterEach(() => {
      globalThis.setTimeout = originalSetTimeout
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
      expect(browser.retry(mockFn, mockOptions)).rejects.toThrow('fail')
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
      expect(browser.retry(mockFn, {})).rejects.toThrow('fail')
      expect(mockFn).toHaveBeenCalledTimes(4) // Default 3 retries + initial attempt
    })

    it('should respect custom retry count', async () => {
      mockFn.mockRejectedValue(new Error('fail'))
      expect(browser.retry(mockFn, { retries: 5 })).rejects.toThrow('fail')
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
    const testCases = [
      { name: 'sleep', fn: browser.sleep },
      { name: 'wait', fn: browser.wait },
      { name: 'delay', fn: browser.delay },
    ]

    testCases.forEach(({ name, fn }) => {
      it(`${name} function pauses execution for the specified time`, async () => {
        const start = Date.now()
        await fn(50)
        const duration = Date.now() - start
        expect(duration).toBeGreaterThanOrEqual(45)
        expect(duration).toBeLessThan(105) // Allow for some overhead, but not too much
      })

      it(`${name} function works with 0ms`, async () => {
        const start = Date.now()
        await fn(0)
        const duration = Date.now() - start
        expect(duration).toBeLessThan(50) // Should resolve almost immediately
      })
    })

    describe('waitUntil function', () => {
      it('resolves when condition becomes true', async () => {
        let flag = false
        setTimeout(() => {
          flag = true
        }, 100)

        const start = Date.now()
        await browser.waitUntil(() => flag)
        const duration = Date.now() - start

        expect(flag).toBe(true)
        expect(duration).toBeGreaterThanOrEqual(95)
        expect(duration).toBeLessThan(150)
      })

      it('uses custom interval', async () => {
        let checkCount = 0
        const condition = () => {
          checkCount++
          return checkCount >= 3
        }

        await browser.waitUntil(condition, 50)
        expect(checkCount).toBe(3)
      })

      it('resolves immediately if condition is initially true', async () => {
        const start = Date.now()
        await browser.waitUntil(() => true)
        const duration = Date.now() - start
        expect(duration).toBeLessThan(50)
      })
    })

    describe('waitWhile function', () => {
      it('resolves when condition becomes false', async () => {
        let flag = true
        setTimeout(() => {
          flag = false
        }, 100)

        const start = Date.now()
        await browser.waitWhile(() => flag)
        const duration = Date.now() - start

        expect(flag).toBe(false)
        expect(duration).toBeGreaterThanOrEqual(95)
        expect(duration).toBeLessThan(150)
      })

      it('uses custom interval', async () => {
        let checkCount = 0
        const condition = () => {
          checkCount++
          return checkCount < 3
        }

        await browser.waitWhile(condition, 50)
        expect(checkCount).toBe(3)
      })

      it('resolves immediately if condition is initially false', async () => {
        const start = Date.now()
        await browser.waitWhile(() => false)
        const duration = Date.now() - start
        expect(duration).toBeLessThan(50)
      })
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
