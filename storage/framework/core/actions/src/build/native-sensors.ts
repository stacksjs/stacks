import type { MobileCapabilities } from '@stacksjs/types'

const SENSOR_CAPABILITY_KEYS = {
  ios: { barometer: 'enableBarometer', pedometer: 'enablePedometer', healthKitBackground: 'enableHealthKitBackground' },
  android: { motionSensors: 'enableMotionSensors', barometer: 'enableBarometer', pedometer: 'enablePedometer' },
} as const satisfies Record<string, Partial<Record<keyof MobileCapabilities, `enable${string}`>>>

/** Only serialize flags the selected builder advertises, including explicit false. */
export function nativeSensorCapabilityKeys(platform: 'ios' | 'android', supported: readonly string[] | undefined): Partial<Record<keyof MobileCapabilities, `enable${string}`>> {
  return Object.fromEntries(Object.entries(SENSOR_CAPABILITY_KEYS[platform]).filter(([name]) => supported?.includes(name)))
}

/** Check the actual builder instead of inventing a version for unreleased support. */
export function assertCraftSupportsNativeSensors(platform: 'ios' | 'android', capabilities: MobileCapabilities | undefined, supported: readonly string[] | undefined): void {
  const checked = Object.keys(SENSOR_CAPABILITY_KEYS[platform]) as Array<keyof MobileCapabilities>
  const missing = checked.filter(name => capabilities?.[name] && !supported?.includes(name))
  if (missing.length)
    throw new Error(`The selected Craft ${platform} builder does not support ${missing.join(', ')}. Install a published craft-native builder supporting these capabilities; these flags cannot be silently ignored.`)
}
