import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { isRef, unref } from './_shared'

export interface UseBase64Return {
  base64: Ref<string>
  execute: () => Promise<string>
}

/**
 * Reactive Base64 encoding.
 *
 * @param source - The value to encode (string, Blob, ArrayBuffer, or canvas)
 */
export function useBase64(
  source: MaybeRef<string | Blob | ArrayBuffer | HTMLCanvasElement>,
): UseBase64Return {
  const base64 = ref('')

  async function encode(input: string | Blob | ArrayBuffer | HTMLCanvasElement): Promise<string> {
    if (typeof input === 'string') {
      if (typeof btoa !== 'undefined')
        return btoa(input)
      // Node/Bun fallback
      return Buffer.from(input).toString('base64')
    }

    if (input instanceof ArrayBuffer) {
      const bytes = new Uint8Array(input)
      let binary = ''
      for (const byte of bytes)
        binary += String.fromCharCode(byte)
      if (typeof btoa !== 'undefined')
        return btoa(binary)
      return Buffer.from(input).toString('base64')
    }

    if (typeof Blob !== 'undefined' && input instanceof Blob) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Remove the data URL prefix
          const base64Part = result.split(',')[1] ?? result
          resolve(base64Part)
        }
        reader.onerror = reject
        reader.readAsDataURL(input)
      })
    }

    if (typeof HTMLCanvasElement !== 'undefined' && input instanceof HTMLCanvasElement) {
      const dataUrl = input.toDataURL()
      return dataUrl.split(',')[1] ?? ''
    }

    return ''
  }

  async function execute(): Promise<string> {
    const val = unref(source)
    const result = await encode(val)
    base64.value = result
    return result
  }

  // Run initially
  execute()

  // Watch if source is a ref
  if (isRef(source)) {
    watch(source as Ref<any>, () => {
      execute()
    })
  }

  return { base64, execute }
}
