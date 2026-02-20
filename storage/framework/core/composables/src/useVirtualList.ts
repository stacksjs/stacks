import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export interface UseVirtualListOptions {
  /** Height of each item in pixels */
  itemHeight: number
  /** Number of items to overscan above and below the visible area. Default: 5 */
  overscan?: number
}

export interface UseVirtualListItem<T> {
  data: T
  index: number
}

export interface UseVirtualListReturn<T> {
  list: Ref<UseVirtualListItem<T>[]>
  containerProps: {
    onScroll: (e: Event) => void
    style: { overflow: string, position: string }
  }
  wrapperProps: Ref<{ style: { width: string, height: string, marginTop: string } }>
  scrollTo: (index: number) => void
}

/**
 * Virtual list for efficiently rendering large lists.
 */
export function useVirtualList<T>(
  source: MaybeRef<T[]>,
  options: UseVirtualListOptions,
): UseVirtualListReturn<T> {
  const { itemHeight, overscan = 5 } = options

  const list = ref<UseVirtualListItem<T>[]>([]) as Ref<UseVirtualListItem<T>[]>
  const containerHeight = ref(0)
  const scrollTop = ref(0)
  const wrapperProps = ref({
    style: { width: '100%', height: '0px', marginTop: '0px' },
  })

  function getItems(): T[] {
    return unref(source) as T[]
  }

  function update(): void {
    const items = getItems()
    const totalHeight = items.length * itemHeight
    const startIndex = Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop.value + containerHeight.value) / itemHeight) + overscan,
    )

    const visibleItems: UseVirtualListItem<T>[] = []
    for (let i = startIndex; i < endIndex; i++) {
      visibleItems.push({ data: items[i], index: i })
    }

    list.value = visibleItems
    wrapperProps.value = {
      style: {
        width: '100%',
        height: `${totalHeight - startIndex * itemHeight}px`,
        marginTop: `${startIndex * itemHeight}px`,
      },
    }
  }

  const onScroll = (e: Event): void => {
    const target = e.target as HTMLElement
    scrollTop.value = target.scrollTop
    containerHeight.value = target.clientHeight
    update()
  }

  // Initialize
  update()

  if (typeof source === 'object' && source && 'value' in source && 'subscribe' in source) {
    watch(source as Ref<T[]>, () => update())
  }

  function scrollTo(index: number): void {
    scrollTop.value = index * itemHeight
    update()
  }

  return {
    list,
    containerProps: {
      onScroll,
      style: { overflow: 'auto', position: 'relative' },
    },
    wrapperProps,
    scrollTo,
  }
}
