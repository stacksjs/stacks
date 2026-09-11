import type { CraftMobileBridge, MobileApi } from '@stacksjs/mobile'
import { getNativeMobileBridge, mobile } from '@stacksjs/mobile'

const services: MobileApi = mobile
const bridge: CraftMobileBridge | null = getNativeMobileBridge()
const current: CraftMobileBridge | null = mobile.nativeBridge

if (bridge) {
  const platform: 'ios' | 'android' = bridge.platform
  const enabled: boolean | undefined = bridge.capabilities.backgroundLocation
  void platform
  void enabled
  // @ts-expect-error Enabled features are boolean, not strings.
  const invalid: string = bridge.capabilities.healthKit
  void invalid
  // @ts-expect-error The public capability view is read-only.
  bridge.capabilities.camera = true
}

const feedback: Promise<number> = services.withFeedback(() => 42)
void feedback
void current
// @ts-expect-error Bridge absence must be checked before reading its platform.
getNativeMobileBridge().platform
// @ts-expect-error Unknown native flags are not a supported capability contract.
mobile.nativeBridge?.capabilities.madeUpCapability
// @ts-expect-error Keep the service collection typed, not any.
mobile.location.startRecording({ enableHighAccuracy: 'yes' })
