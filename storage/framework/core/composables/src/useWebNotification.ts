import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UseWebNotificationOptions {
  title?: string
  body?: string
  icon?: string
  dir?: NotificationDirection
  lang?: string
  tag?: string
  requireInteraction?: boolean
}

export interface UseWebNotificationReturn {
  isSupported: Ref<boolean>
  notification: Ref<Notification | null>
  permissionGranted: Ref<boolean>
  show: (overrideOptions?: UseWebNotificationOptions) => Promise<Notification | undefined>
  close: () => void
  onClick: Ref<((evt: Event) => void) | null>
  onShow: Ref<((evt: Event) => void) | null>
  onError: Ref<((evt: Event) => void) | null>
  onClose: Ref<((evt: Event) => void) | null>
}

/**
 * Reactive Web Notification API.
 */
export function useWebNotification(options: UseWebNotificationOptions = {}): UseWebNotificationReturn {
  const isSupported = ref(typeof Notification !== 'undefined')
  const notification = ref<Notification | null>(null) as Ref<Notification | null>
  const permissionGranted = ref(isSupported.value && Notification.permission === 'granted')
  const onClick = ref<((evt: Event) => void) | null>(null) as Ref<((evt: Event) => void) | null>
  const onShow = ref<((evt: Event) => void) | null>(null) as Ref<((evt: Event) => void) | null>
  const onError = ref<((evt: Event) => void) | null>(null) as Ref<((evt: Event) => void) | null>
  const onClose = ref<((evt: Event) => void) | null>(null) as Ref<((evt: Event) => void) | null>

  async function show(overrideOptions?: UseWebNotificationOptions): Promise<Notification | undefined> {
    if (!isSupported.value) return undefined

    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission()
      permissionGranted.value = result === 'granted'
      if (!permissionGranted.value) return undefined
    }

    const opts = { ...options, ...overrideOptions }
    const title = opts.title ?? ''

    const n = new Notification(title, {
      body: opts.body,
      icon: opts.icon,
      dir: opts.dir,
      lang: opts.lang,
      tag: opts.tag,
      requireInteraction: opts.requireInteraction,
    })

    notification.value = n
    n.onclick = (e) => onClick.value?.(e)
    n.onshow = (e) => onShow.value?.(e)
    n.onerror = (e) => onError.value?.(e)
    n.onclose = (e) => {
      onClose.value?.(e)
      notification.value = null
    }

    return n
  }

  function close(): void {
    notification.value?.close()
    notification.value = null
  }

  try {
    onUnmounted(() => close())
  }
  catch {
    // Not in a component context
  }

  return { isSupported, notification, permissionGranted, show, close, onClick, onShow, onError, onClose }
}
