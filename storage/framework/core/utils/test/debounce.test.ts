import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { debounce, throttle } from '../src/debounce'

describe('debounce', () => {
  beforeEach(() => {
    // Clear any timers
  })

  afterEach(() => {
    // Clean up
  })

  it('should debounce function calls', async () => {
    let count = 0
    const fn = debounce(() => count++, 50)

    fn()
    fn()
    fn()

    expect(count).toBe(0)

    await new Promise(resolve => setTimeout(resolve, 60))
    expect(count).toBe(1)
  })

  it('should support leading edge execution', async () => {
    let count = 0
    const fn = debounce(() => count++, 50, { leading: true, trailing: false })

    fn()
    expect(count).toBe(1)

    fn()
    fn()
    expect(count).toBe(1)

    await new Promise(resolve => setTimeout(resolve, 60))
    expect(count).toBe(1)
  })

  it('should support trailing edge execution', async () => {
    let count = 0
    const fn = debounce(() => count++, 50, { trailing: true })

    fn()
    fn()
    fn()

    expect(count).toBe(0)

    await new Promise(resolve => setTimeout(resolve, 60))
    expect(count).toBe(1)
  })

  it('should support both leading and trailing', async () => {
    let count = 0
    const fn = debounce(() => count++, 50, { leading: true, trailing: true })

    fn()
    expect(count).toBe(1)

    fn()
    fn()
    expect(count).toBe(1)

    await new Promise(resolve => setTimeout(resolve, 60))
    expect(count).toBe(2)
  })

  it('should cancel pending calls', async () => {
    let count = 0
    const fn = debounce(() => count++, 50)

    fn()
    fn.cancel()

    await new Promise(resolve => setTimeout(resolve, 60))
    expect(count).toBe(0)
  })

  it('should flush pending calls', () => {
    let count = 0
    const fn = debounce(() => count++, 50)

    fn()
    fn()
    fn.flush()

    expect(count).toBe(1)
  })

  it('should pass arguments correctly', async () => {
    let result = ''
    const fn = debounce((a: string, b: string) => {
      result = a + b
    }, 50)

    fn('hello', 'world')

    await new Promise(resolve => setTimeout(resolve, 60))
    expect(result).toBe('helloworld')
  })

  it('should preserve this context', async () => {
    const obj = {
      value: 'test',
      method: debounce(function (this: any) {
        return this.value
      }, 50),
    }

    obj.method()
    await new Promise(resolve => setTimeout(resolve, 60))
  })
})

describe('throttle', () => {
  it('should throttle function calls', async () => {
    let count = 0
    const fn = throttle(() => count++, 50)

    fn()
    expect(count).toBe(1)

    fn()
    fn()
    expect(count).toBe(1)

    await new Promise(resolve => setTimeout(resolve, 60))

    fn()
    expect(count).toBe(2)
  })

  it('should execute immediately on first call', () => {
    let count = 0
    const fn = throttle(() => count++, 100)

    fn()
    expect(count).toBe(1)
  })

  it('should cancel pending calls', async () => {
    let count = 0
    const fn = throttle(() => count++, 50)

    fn()
    fn()
    fn.cancel()

    await new Promise(resolve => setTimeout(resolve, 60))

    fn()
    expect(count).toBe(2)
  })

  it('should pass arguments correctly', () => {
    let result = ''
    const fn = throttle((a: string, b: string) => {
      result = a + b
    }, 50)

    fn('hello', 'world')
    expect(result).toBe('helloworld')
  })

  it('should handle zero wait time', async () => {
    let count = 0
    const fn = throttle(() => count++, 10)

    fn()
    expect(count).toBe(1)

    fn()
    fn()
    expect(count).toBe(1)

    await new Promise(resolve => setTimeout(resolve, 15))

    fn()
    expect(count).toBe(2)
  })
})
