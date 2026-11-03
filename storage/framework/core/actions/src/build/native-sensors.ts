import type { MobileCapabilities } from '@stacksjs/types'

/** Check the actual builder instead of inventing a version for unreleased support. */
export function assertCraftSupportsNativeSensors(platform: 'ios' | 'android', capabilities: MobileCapabilities | undefined, supported: readonly string[] | undefined): void {
  const checked: Array<keyof MobileCapabilities> = platform === 'android'
    ? ['motionSensors', 'barometer', 'pedometer']
    : ['barometer', 'pedometer', 'healthKitBackground']
  const missing = checked.filter(name => capabilities?.[name] && !supported?.includes(name))
  if (missing.length)
    throw new Error(`The selected Craft ${platform} builder does not support ${missing.join(', ')}. Update craft-native or set CRAFT_${platform.toUpperCase()}_SRC to a compatible builder; these flags cannot be silently ignored.`)
}
