/**
 * Tests for `@stacksjs/storage/image` (stacksjs/stacks#1856 Stage 5).
 *
 * sharp is a peer dependency — these tests don't require it. They
 * verify the shape of the wrapper module (`transform`, `avatar`,
 * `resize`, `stripMetadata`) and the clear error users see when sharp
 * isn't installed.
 *
 * The actual sharp pipeline (resize/webp/etc.) is sharp's own test
 * surface — we cover the integration shim, not the image library.
 */

import { describe, expect, test } from 'bun:test'
import { avatar, resize, stripMetadata, transform } from '../src/image'

describe('@stacksjs/storage/image — exports', () => {
  test('factory functions are present', () => {
    expect(typeof transform).toBe('function')
    expect(typeof avatar).toBe('function')
    expect(typeof resize).toBe('function')
    expect(typeof stripMetadata).toBe('function')
  })

  test('each preset returns a function suitable for `Storage.put({ transform })`', () => {
    expect(typeof avatar()).toBe('function')
    expect(typeof resize(100, 100)).toBe('function')
    expect(typeof stripMetadata()).toBe('function')
    expect(typeof transform(img => img)).toBe('function')
  })
})

describe('@stacksjs/storage/image — lazy sharp load error', () => {
  // sharp is not a dependency in the framework's own test environment.
  // The presets should throw a clear install message rather than a
  // bare `Cannot find module` when invoked.
  test('`avatar()` throws a friendly error when sharp is missing', async () => {
    const fn = avatar()
    await expect(fn(new Uint8Array([1, 2, 3]))).rejects.toThrow(/sharp.*not installed/i)
  })

  test('the error message includes the install command', async () => {
    const fn = transform(img => img)
    try {
      await fn(new Uint8Array([1, 2, 3]))
      throw new Error('expected sharp-missing error')
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      expect(message).toContain('bun add sharp')
    }
  })
})
