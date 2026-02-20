import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { noop } from './_shared'

interface BatteryManager extends EventTarget {
  charging: boolean
  chargingTime: number
  dischargingTime: number
  level: number
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>
}

export interface UseBatteryReturn {
  charging: Ref<boolean>
  chargingTime: Ref<number>
  dischargingTime: Ref<number>
  level: Ref<number>
  isSupported: Ref<boolean>
}

/**
 * Reactive battery status.
 * Tracks battery charging state, charge/discharge times, and level using the Battery Status API.
 *
 * @returns Reactive battery properties and support status
 */
export function useBattery(): UseBatteryReturn {
  const nav = typeof navigator !== 'undefined' ? navigator as NavigatorWithBattery : undefined
  const isSupported = ref(!!nav?.getBattery)

  const charging = ref(false)
  const chargingTime = ref(0)
  const dischargingTime = ref(0)
  const level = ref(1)

  const cleanups: Array<() => void> = []
  let cleanup = noop

  if (isSupported.value && nav?.getBattery) {
    nav.getBattery().then((battery) => {
      const updateBatteryInfo = (): void => {
        charging.value = battery.charging
        chargingTime.value = battery.chargingTime
        dischargingTime.value = battery.dischargingTime
        level.value = battery.level
      }

      // Initial read
      updateBatteryInfo()

      // Listen for changes
      battery.addEventListener('chargingchange', updateBatteryInfo)
      battery.addEventListener('chargingtimechange', updateBatteryInfo)
      battery.addEventListener('dischargingtimechange', updateBatteryInfo)
      battery.addEventListener('levelchange', updateBatteryInfo)

      cleanups.push(() => {
        battery.removeEventListener('chargingchange', updateBatteryInfo)
        battery.removeEventListener('chargingtimechange', updateBatteryInfo)
        battery.removeEventListener('dischargingtimechange', updateBatteryInfo)
        battery.removeEventListener('levelchange', updateBatteryInfo)
      })

      cleanup = () => {
        for (const fn of cleanups) fn()
        cleanups.length = 0
        cleanup = noop
      }
    }).catch(() => {
      isSupported.value = false
    })
  }

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return { charging, chargingTime, dischargingTime, level, isSupported }
}
