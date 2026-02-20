import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UseBroadcastChannelReturn {
  isSupported: Ref<boolean>
  channel: Ref<BroadcastChannel | undefined>
  data: Ref<any>
  error: Ref<any>
  post: (data: any) => void
  close: () => void
  isClosed: Ref<boolean>
}

/**
 * Reactive BroadcastChannel API for cross-tab communication.
 */
export function useBroadcastChannel(name: string): UseBroadcastChannelReturn {
  const isSupported = ref(typeof BroadcastChannel !== 'undefined')
  const channel = ref<BroadcastChannel | undefined>(undefined)
  const data = ref<any>(null)
  const error = ref<any>(null)
  const isClosed = ref(false)

  if (isSupported.value) {
    const bc = new BroadcastChannel(name)
    channel.value = bc

    bc.onmessage = (e: MessageEvent) => {
      data.value = e.data
    }

    bc.onmessageerror = (e: MessageEvent) => {
      error.value = e
    }

    try {
      onUnmounted(() => {
        bc.close()
        isClosed.value = true
      })
    }
    catch {
      // Not in a component context
    }
  }

  function post(message: any): void {
    if (channel.value && !isClosed.value)
      channel.value.postMessage(message)
  }

  function close(): void {
    if (channel.value && !isClosed.value) {
      channel.value.close()
      isClosed.value = true
    }
  }

  return { isSupported, channel, data, error, post, close, isClosed }
}
