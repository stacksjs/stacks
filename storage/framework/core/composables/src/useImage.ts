import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

export interface UseImageOptions {
  src: string
  srcset?: string
  sizes?: string
  alt?: string
  crossorigin?: string
  referrerpolicy?: string
}

export interface UseImageReturn {
  isLoading: Ref<boolean>
  error: Ref<string | null>
  isReady: Ref<boolean>
}

/**
 * Reactive image loading state.
 */
export function useImage(options: UseImageOptions): UseImageReturn {
  const isLoading = ref(true)
  const isReady = ref(false)
  const error = ref<string | null>(null) as Ref<string | null>

  if (typeof Image === 'undefined') {
    isLoading.value = false
    return { isLoading, error, isReady }
  }

  const img = new Image()

  img.onload = () => {
    isLoading.value = false
    isReady.value = true
  }

  img.onerror = (e) => {
    isLoading.value = false
    if (typeof e === 'string') {
      error.value = e
    }
    else if (e instanceof Event && e.type === 'error') {
      error.value = `Failed to load image: ${options.src}`
    }
    else {
      error.value = 'Failed to load image'
    }
  }

  if (options.crossorigin)
    img.crossOrigin = options.crossorigin
  if (options.referrerpolicy)
    img.referrerPolicy = options.referrerpolicy as ReferrerPolicy
  if (options.sizes)
    img.sizes = options.sizes
  if (options.srcset)
    img.srcset = options.srcset

  img.src = options.src

  return { isLoading, error, isReady }
}
