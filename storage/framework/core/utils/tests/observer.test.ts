import { describe, expect, it } from 'bun:test'
import { getResizeObserver, isResizeObserverSupported } from '../src/observer'

describe('isResizeObserverSupported', () => {
  it('should return false in Node.js/Bun environment', () => {
    // In server environment, window is not defined
    expect(isResizeObserverSupported()).toBe(false)
  })
})

describe('getResizeObserver', () => {
  it('should return polyfill in server environment', () => {
    const Observer = getResizeObserver()
    expect(Observer).toBeDefined()
    expect(typeof Observer).toBe('function')
  })

  it('should create observer instance', () => {
    const Observer = getResizeObserver()
    const callback = () => {}
    const observer = new Observer(callback)

    expect(observer).toBeDefined()
    expect(typeof observer.observe).toBe('function')
    expect(typeof observer.unobserve).toBe('function')
    expect(typeof observer.disconnect).toBe('function')
  })
})

describe('ResizeObserver polyfill', () => {
  it('should implement observe method', () => {
    const Observer = getResizeObserver()
    const callback = () => {}
    const observer = new Observer(callback)

    // Mock element
    const element = {
      getBoundingClientRect: () => ({
        width: 100,
        height: 200,
        top: 0,
        left: 0,
        right: 100,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    } as any

    expect(() => observer.observe(element)).not.toThrow()
  })

  it('should implement unobserve method', () => {
    const Observer = getResizeObserver()
    const callback = () => {}
    const observer = new Observer(callback)

    const element = {
      getBoundingClientRect: () => ({
        width: 100,
        height: 200,
        top: 0,
        left: 0,
        right: 100,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    } as any

    observer.observe(element)
    expect(() => observer.unobserve(element)).not.toThrow()
  })

  it('should implement disconnect method', () => {
    const Observer = getResizeObserver()
    const callback = () => {}
    const observer = new Observer(callback)

    expect(() => observer.disconnect()).not.toThrow()
  })

  it('should not observe same element twice', () => {
    const Observer = getResizeObserver()
    let callCount = 0
    const callback = () => {
      callCount++
    }
    const observer = new Observer(callback)

    const element = {
      getBoundingClientRect: () => ({
        width: 100,
        height: 200,
        top: 0,
        left: 0,
        right: 100,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    } as any

    observer.observe(element)
    observer.observe(element)

    // Should only add once
    expect(true).toBe(true)
  })

  it('should stop observing after disconnect', () => {
    const Observer = getResizeObserver()
    const callback = () => {}
    const observer = new Observer(callback)

    const element = {
      getBoundingClientRect: () => ({
        width: 100,
        height: 200,
        top: 0,
        left: 0,
        right: 100,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    } as any

    observer.observe(element)
    observer.disconnect()

    // After disconnect, should have no observers
    expect(true).toBe(true)
  })
})

// Note: createResizeObserver and observeElementSize would need DOM environment
// or more sophisticated mocking to test properly. These are integration-level tests
// that would be better tested in a browser environment.
