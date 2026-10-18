import type { CraftMobileBridge, MobileApi } from '@stacksjs/mobile'
import { crypto, getNativeMobileBridge, heartRate, location, mobile, storage } from '@stacksjs/mobile'

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

// Compile the new ownership and storage APIs from the installed declarations.
// This function is type-checked without starting a native recording.
function verifyOwnedNativeApis() {
  const uuid: Promise<string> = crypto.randomUUID()
  const namespacedUuid: Promise<string> = mobile.crypto.randomUUID()
  const supportsCas: boolean = storage.supportsCompareAndSet()
  const supportsCreate: boolean = mobile.storage.supportsSetIfAbsent()
  const cas: Promise<boolean> = storage.compareAndSet('owned-session', null, { owner: 'athlete' })
  const created: Promise<boolean> = mobile.storage.setIfAbsent('owned-session', { owner: 'athlete' })
  const gpsIdentity: boolean = location.supportsRecordingIntentIdentity()
  const heartIdentity: boolean = heartRate.supportsRecordingIntentIdentity()
  const gps = mobile.location.startRecording({ recordingId: 'saved-gps-id', enableHighAccuracy: true })
  const heart = mobile.heartRate.startRecording({ recordingId: 'saved-heart-id' })
  const acknowledged: Promise<boolean> = location.acknowledgeRecording({ expectedId: 'saved-gps-id' })
  void [uuid, namespacedUuid, supportsCas, supportsCreate, cas, created, gpsIdentity, heartIdentity, gps, heart, acknowledged]

  // @ts-expect-error Durable storage keys are strings.
  storage.compareAndSet(42, null, {})
  // @ts-expect-error Atomic creation requires its value.
  mobile.storage.setIfAbsent('owned-session')
  // @ts-expect-error UUID generation takes no caller-supplied entropy.
  crypto.randomUUID(42)
  // @ts-expect-error Saved native identities are strings.
  location.startRecording({ recordingId: 42 })
  // @ts-expect-error Acknowledgement must identify a saved recording.
  heartRate.acknowledgeRecording({ expectedId: 42 })
}
void verifyOwnedNativeApis
