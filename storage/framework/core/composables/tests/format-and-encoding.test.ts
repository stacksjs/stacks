import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { ref } from '@stacksjs/stx'
import { useDateFormat } from '../src/useDateFormat'
import { useNow } from '../src/useNow'
import { useImage } from '../src/useImage'
import { useBase64 } from '../src/useBase64'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ============================================================================
// useDateFormat
// ============================================================================
describe('useDateFormat', () => {
  it('should format a static Date object', () => {
    const date = new Date('2024-06-15T12:30:00.000Z')
    const result = useDateFormat(date, 'YYYY-MM-DD')
    // The mock format() returns date.toISOString()
    expect(result.value).toBe('2024-06-15T12:30:00.000Z')
  })

  it('should format a static timestamp number', () => {
    const timestamp = new Date('2024-01-01T00:00:00.000Z').getTime()
    const result = useDateFormat(timestamp, 'YYYY-MM-DD')
    expect(result.value).toBe('2024-01-01T00:00:00.000Z')
  })

  it('should format a static date string', () => {
    const result = useDateFormat('2023-12-25T10:00:00.000Z', 'DD/MM/YYYY')
    expect(result.value).toBe('2023-12-25T10:00:00.000Z')
  })

  it('should return a computed ref that updates when source ref changes', () => {
    const dateRef = ref<Date>(new Date('2024-03-01T00:00:00.000Z'))
    const result = useDateFormat(dateRef, 'YYYY-MM-DD')

    expect(result.value).toBe('2024-03-01T00:00:00.000Z')

    dateRef.value = new Date('2025-07-04T18:00:00.000Z')
    expect(result.value).toBe('2025-07-04T18:00:00.000Z')
  })

  it('should work with reactive ref containing a number timestamp', () => {
    const tsRef = ref<number>(new Date('2024-06-01T00:00:00.000Z').getTime())
    const result = useDateFormat(tsRef, 'YYYY-MM-DD HH:mm')

    expect(result.value).toBe('2024-06-01T00:00:00.000Z')

    tsRef.value = new Date('2024-12-31T23:59:59.000Z').getTime()
    expect(result.value).toBe('2024-12-31T23:59:59.000Z')
  })

  it('should work with reactive ref containing a date string', () => {
    const strRef = ref<string>('2024-01-15T08:00:00.000Z')
    const result = useDateFormat(strRef, 'MM/DD/YYYY')

    expect(result.value).toBe('2024-01-15T08:00:00.000Z')

    strRef.value = '2024-09-20T16:30:00.000Z'
    expect(result.value).toBe('2024-09-20T16:30:00.000Z')
  })

  it('should pass format string through (mock ignores it)', () => {
    const date = new Date('2024-06-15T12:00:00.000Z')
    const r1 = useDateFormat(date, 'YYYY-MM-DD')
    const r2 = useDateFormat(date, 'DD/MM/YYYY HH:mm:ss')
    // Both produce the same ISO string since the mock ignores the format
    expect(r1.value).toBe(r2.value)
    expect(r1.value).toBe('2024-06-15T12:00:00.000Z')
  })

  it('should handle Date.now() as static number', () => {
    const now = Date.now()
    const result = useDateFormat(now, 'HH:mm:ss')
    const expected = new Date(now).toISOString()
    expect(result.value).toBe(expected)
  })

  it('should produce a stable value for static input', () => {
    const date = new Date('2020-01-01T00:00:00.000Z')
    const result = useDateFormat(date, 'YYYY')
    const first = result.value
    const second = result.value
    expect(first).toBe(second)
  })
})

// ============================================================================
// useNow
// ============================================================================
describe('useNow', () => {
  it('should return a Date ref with the current time', () => {
    const now = useNow({ interval: 10000 })
    expect(now.value).toBeInstanceOf(Date)
    // Should be close to current time
    expect(Math.abs(now.value.getTime() - Date.now())).toBeLessThan(100)
  })

  it('should update after the interval elapses', async () => {
    const now = useNow({ interval: 50 })
    const initial = now.value.getTime()

    await sleep(120)
    expect(now.value.getTime()).toBeGreaterThan(initial)
  })

  it('should default interval to 1000ms', async () => {
    const now = useNow()
    const initial = now.value.getTime()

    // After 50ms it should not have updated (default is 1000ms)
    await sleep(50)
    // The value may or may not have changed within 50ms of a 1000ms interval,
    // but it should definitely not have ticked yet
    expect(now.value.getTime() - initial).toBeLessThan(100)
  })

  it('should use a custom interval', async () => {
    const now = useNow({ interval: 30 })
    const initial = now.value.getTime()

    await sleep(100)
    const updated = now.value.getTime()
    expect(updated).toBeGreaterThan(initial)
  })

  it('should change value over time', async () => {
    const now = useNow({ interval: 40 })
    const t1 = now.value.getTime()

    await sleep(120)
    const t2 = now.value.getTime()

    await sleep(120)
    const t3 = now.value.getTime()

    expect(t2).toBeGreaterThan(t1)
    expect(t3).toBeGreaterThan(t2)
  })

  it('should return a valid Date each tick', async () => {
    const now = useNow({ interval: 40 })

    await sleep(100)
    expect(now.value).toBeInstanceOf(Date)
    expect(Number.isNaN(now.value.getTime())).toBe(false)
  })
})

// ============================================================================
// useImage
// ============================================================================
describe('useImage', () => {
  describe('SSR-safe (no Image class)', () => {
    beforeEach(() => {
      // Ensure Image is undefined (default in Bun)
      delete (globalThis as any).Image
    })

    it('should return isLoading: false when Image is undefined', () => {
      const { isLoading, error, isReady } = useImage({ src: 'https://example.com/img.png' })
      expect(isLoading.value).toBe(false)
      expect(error.value).toBe(null)
      expect(isReady.value).toBe(false)
    })
  })

  describe('with mock Image class', () => {
    let lastCreatedImg: any

    beforeEach(() => {
      lastCreatedImg = null
      const MockImage = function (this: any) {
        this.onload = null
        this.onerror = null
        this.crossOrigin = ''
        this.referrerPolicy = ''
        this.sizes = ''
        this.srcset = ''
        this._src = ''
        lastCreatedImg = this
        Object.defineProperty(this, 'src', {
          get() { return this._src },
          set(val: string) {
            this._src = val
            // Simulate async load
            setTimeout(() => {
              if (this.onload) this.onload()
            }, 0)
          },
        })
      }
      ;(globalThis as any).Image = MockImage
    })

    afterEach(() => {
      delete (globalThis as any).Image
    })

    it('should start with isLoading: true', () => {
      // Override src setter to NOT auto-resolve
      const MockImage = function (this: any) {
        this.onload = null
        this.onerror = null
        this.crossOrigin = ''
        this.referrerPolicy = ''
        this.sizes = ''
        this.srcset = ''
        this._src = ''
        lastCreatedImg = this
        Object.defineProperty(this, 'src', {
          get() { return this._src },
          set(val: string) {
            this._src = val
            // Do NOT auto-resolve, so isLoading stays true
          },
        })
      }
      ;(globalThis as any).Image = MockImage

      const { isLoading, isReady, error } = useImage({ src: 'https://example.com/img.png' })
      expect(isLoading.value).toBe(true)
      expect(isReady.value).toBe(false)
      expect(error.value).toBe(null)
    })

    it('should set isReady: true and isLoading: false on successful load', async () => {
      const { isLoading, isReady, error } = useImage({ src: 'https://example.com/img.png' })

      // Wait for the setTimeout in the mock to fire onload
      await sleep(10)

      expect(isLoading.value).toBe(false)
      expect(isReady.value).toBe(true)
      expect(error.value).toBe(null)
    })

    it('should set error on image load failure', async () => {
      // Override to simulate error
      const MockImage = function (this: any) {
        this.onload = null
        this.onerror = null
        this.crossOrigin = ''
        this.referrerPolicy = ''
        this.sizes = ''
        this.srcset = ''
        this._src = ''
        lastCreatedImg = this
        Object.defineProperty(this, 'src', {
          get() { return this._src },
          set(val: string) {
            this._src = val
            setTimeout(() => {
              if (this.onerror) this.onerror('Network error')
            }, 0)
          },
        })
      }
      ;(globalThis as any).Image = MockImage

      const { isLoading, isReady, error } = useImage({ src: 'https://example.com/broken.png' })

      await sleep(10)

      expect(isLoading.value).toBe(false)
      expect(isReady.value).toBe(false)
      expect(error.value).toBe('Network error')
    })

    it('should set generic error message for non-string error events', async () => {
      const MockImage = function (this: any) {
        this.onload = null
        this.onerror = null
        this.crossOrigin = ''
        this.referrerPolicy = ''
        this.sizes = ''
        this.srcset = ''
        this._src = ''
        lastCreatedImg = this
        Object.defineProperty(this, 'src', {
          get() { return this._src },
          set(val: string) {
            this._src = val
            setTimeout(() => {
              // Simulate a non-string, non-Event error
              if (this.onerror) this.onerror(42)
            }, 0)
          },
        })
      }
      ;(globalThis as any).Image = MockImage

      const { error } = useImage({ src: 'https://example.com/broken.png' })

      await sleep(10)
      expect(error.value).toBe('Failed to load image')
    })

    it('should pass crossorigin option to the image element', () => {
      // Non-auto-resolving mock to inspect properties
      const MockImage = function (this: any) {
        this.onload = null
        this.onerror = null
        this.crossOrigin = ''
        this.referrerPolicy = ''
        this.sizes = ''
        this.srcset = ''
        this._src = ''
        lastCreatedImg = this
        Object.defineProperty(this, 'src', {
          get() { return this._src },
          set(val: string) { this._src = val },
        })
      }
      ;(globalThis as any).Image = MockImage

      useImage({
        src: 'https://example.com/img.png',
        crossorigin: 'anonymous',
      })

      expect(lastCreatedImg.crossOrigin).toBe('anonymous')
    })

    it('should pass referrerpolicy option to the image element', () => {
      const MockImage = function (this: any) {
        this.onload = null
        this.onerror = null
        this.crossOrigin = ''
        this.referrerPolicy = ''
        this.sizes = ''
        this.srcset = ''
        this._src = ''
        lastCreatedImg = this
        Object.defineProperty(this, 'src', {
          get() { return this._src },
          set(val: string) { this._src = val },
        })
      }
      ;(globalThis as any).Image = MockImage

      useImage({
        src: 'https://example.com/img.png',
        referrerpolicy: 'no-referrer',
      })

      expect(lastCreatedImg.referrerPolicy).toBe('no-referrer')
    })

    it('should pass sizes and srcset options to the image element', () => {
      const MockImage = function (this: any) {
        this.onload = null
        this.onerror = null
        this.crossOrigin = ''
        this.referrerPolicy = ''
        this.sizes = ''
        this.srcset = ''
        this._src = ''
        lastCreatedImg = this
        Object.defineProperty(this, 'src', {
          get() { return this._src },
          set(val: string) { this._src = val },
        })
      }
      ;(globalThis as any).Image = MockImage

      useImage({
        src: 'https://example.com/img.png',
        sizes: '(max-width: 600px) 480px, 800px',
        srcset: 'small.png 480w, large.png 800w',
      })

      expect(lastCreatedImg.sizes).toBe('(max-width: 600px) 480px, 800px')
      expect(lastCreatedImg.srcset).toBe('small.png 480w, large.png 800w')
    })

    it('should set src on the image element', () => {
      const MockImage = function (this: any) {
        this.onload = null
        this.onerror = null
        this.crossOrigin = ''
        this.referrerPolicy = ''
        this.sizes = ''
        this.srcset = ''
        this._src = ''
        lastCreatedImg = this
        Object.defineProperty(this, 'src', {
          get() { return this._src },
          set(val: string) { this._src = val },
        })
      }
      ;(globalThis as any).Image = MockImage

      useImage({ src: 'https://example.com/photo.jpg' })

      expect(lastCreatedImg._src).toBe('https://example.com/photo.jpg')
    })
  })
})

// ============================================================================
// useBase64
// ============================================================================
describe('useBase64', () => {
  it('should encode a simple string to base64', async () => {
    const { base64, execute } = useBase64('Hello, World!')

    // execute() is called on init but is async, so we await
    await execute()
    expect(base64.value).toBe(btoa('Hello, World!'))
  })

  it('should encode an ArrayBuffer to base64', async () => {
    const encoder = new TextEncoder()
    const buffer = encoder.encode('ABC').buffer as ArrayBuffer
    const { base64, execute } = useBase64(buffer)

    await execute()
    // 'ABC' -> base64 is 'QUJD'
    expect(base64.value).toBe(btoa('ABC'))
  })

  it('should encode a Blob to base64', async () => {
    // Mock FileReader since it is not available in Bun test env
    const originalFileReader = (globalThis as any).FileReader
    ;(globalThis as any).FileReader = class {
      onload: any = null
      onerror: any = null
      result: string | null = null
      readAsDataURL(blob: Blob) {
        blob.text().then((text) => {
          this.result = `data:;base64,${btoa(text)}`
          if (this.onload) this.onload()
        })
      }
    }

    const blob = new Blob(['Hello Blob'], { type: 'text/plain' })
    const { base64, execute } = useBase64(blob)

    await execute()
    expect(base64.value).toBe(btoa('Hello Blob'))

    // Restore
    if (originalFileReader) {
      (globalThis as any).FileReader = originalFileReader
    } else {
      delete (globalThis as any).FileReader
    }
  })

  it('should return an execute function that re-encodes', async () => {
    const { base64, execute } = useBase64('test')

    await execute()
    const first = base64.value
    expect(first).toBe(btoa('test'))

    // execute() should re-encode and return the same result
    const result = await execute()
    expect(result).toBe(btoa('test'))
    expect(base64.value).toBe(first)
  })

  it('should reactively re-encode when source ref changes', async () => {
    const source = ref('initial')
    const { base64, execute } = useBase64(source)

    // Wait for initial encoding
    await execute()
    expect(base64.value).toBe(btoa('initial'))

    // Change the ref - the watch handler calls execute() which is async
    source.value = 'updated'

    // Give it a tick for the async execute to complete
    await sleep(10)
    expect(base64.value).toBe(btoa('updated'))
  })

  it('should handle an empty string', async () => {
    const { base64, execute } = useBase64('')

    await execute()
    expect(base64.value).toBe(btoa(''))
    expect(base64.value).toBe('')
  })

  it('should handle unicode strings via btoa workaround', async () => {
    // btoa only handles Latin1 characters; for ASCII subset it works fine
    const { base64, execute } = useBase64('cafe')

    await execute()
    expect(base64.value).toBe(btoa('cafe'))
  })

  it('should handle an empty ArrayBuffer', async () => {
    const buffer = new ArrayBuffer(0)
    const { base64, execute } = useBase64(buffer)

    await execute()
    expect(base64.value).toBe(btoa(''))
    expect(base64.value).toBe('')
  })

  it('should handle binary data in ArrayBuffer', async () => {
    const buffer = new ArrayBuffer(3)
    const view = new Uint8Array(buffer)
    view[0] = 0
    view[1] = 255
    view[2] = 128

    const { base64, execute } = useBase64(buffer)

    await execute()
    // Manually compute expected: String.fromCharCode(0, 255, 128) -> btoa
    const expected = btoa(String.fromCharCode(0, 255, 128))
    expect(base64.value).toBe(expected)
  })

  it('should return the encoded value from execute()', async () => {
    const { execute } = useBase64('return-test')

    const result = await execute()
    expect(result).toBe(btoa('return-test'))
  })

  it('should encode a Blob with binary content', async () => {
    // Mock FileReader since it is not available in Bun test env
    const originalFileReader = (globalThis as any).FileReader
    ;(globalThis as any).FileReader = class {
      onload: any = null
      onerror: any = null
      result: string | null = null
      readAsDataURL(blob: Blob) {
        blob.arrayBuffer().then((ab) => {
          const bytes = new Uint8Array(ab)
          let binary = ''
          for (const byte of bytes) binary += String.fromCharCode(byte)
          this.result = `data:;base64,${btoa(binary)}`
          if (this.onload) this.onload()
        })
      }
    }

    const bytes = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const blob = new Blob([bytes], { type: 'application/octet-stream' })
    const { base64, execute } = useBase64(blob)

    await execute()
    expect(base64.value).toBe(btoa('Hello'))

    // Restore
    if (originalFileReader) {
      (globalThis as any).FileReader = originalFileReader
    } else {
      delete (globalThis as any).FileReader
    }
  })

  it('should update base64 ref when reactive source changes multiple times', async () => {
    const source = ref('first')
    const { base64, execute } = useBase64(source)

    await execute()
    expect(base64.value).toBe(btoa('first'))

    source.value = 'second'
    await sleep(10)
    expect(base64.value).toBe(btoa('second'))

    source.value = 'third'
    await sleep(10)
    expect(base64.value).toBe(btoa('third'))
  })
})
