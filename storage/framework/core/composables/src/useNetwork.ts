import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export type NetworkEffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | undefined

export interface UseNetworkReturn {
  isSupported: Ref<boolean>
  isOnline: Ref<boolean>
  offlineAt: Ref<number | undefined>
  onlineAt: Ref<number | undefined>
  downlink: Ref<number | undefined>
  downlinkMax: Ref<number | undefined>
  effectiveType: Ref<NetworkEffectiveType>
  rtt: Ref<number | undefined>
  saveData: Ref<boolean | undefined>
  type: Ref<string | undefined>
}

/**
 * Reactive Network Information API.
 */
export function useNetwork(): UseNetworkReturn {
  const isSupported = ref(typeof navigator !== 'undefined' && 'connection' in navigator)
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const offlineAt = ref<number | undefined>(undefined)
  const onlineAt = ref<number | undefined>(undefined)
  const downlink = ref<number | undefined>(undefined)
  const downlinkMax = ref<number | undefined>(undefined)
  const effectiveType = ref<NetworkEffectiveType>(undefined)
  const rtt = ref<number | undefined>(undefined)
  const saveData = ref<boolean | undefined>(undefined)
  const type = ref<string | undefined>(undefined)

  function updateNetworkInfo(): void {
    if (!isSupported.value) return
    const conn = (navigator as any).connection
    if (conn) {
      downlink.value = conn.downlink
      downlinkMax.value = conn.downlinkMax
      effectiveType.value = conn.effectiveType
      rtt.value = conn.rtt
      saveData.value = conn.saveData
      type.value = conn.type
    }
  }

  updateNetworkInfo()

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      isOnline.value = true
      onlineAt.value = Date.now()
    })
    window.addEventListener('offline', () => {
      isOnline.value = false
      offlineAt.value = Date.now()
    })

    if (isSupported.value) {
      const conn = (navigator as any).connection
      if (conn?.addEventListener) {
        conn.addEventListener('change', updateNetworkInfo)
        try {
          onUnmounted(() => {
            conn.removeEventListener('change', updateNetworkInfo)
          })
        }
        catch {
          // Not in a component context
        }
      }
    }
  }

  return {
    isSupported,
    isOnline,
    offlineAt,
    onlineAt,
    downlink,
    downlinkMax,
    effectiveType,
    rtt,
    saveData,
    type,
  }
}
