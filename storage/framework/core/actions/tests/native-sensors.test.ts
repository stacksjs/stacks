import { describe, expect, it } from 'bun:test'
import { assertCraftSupportsNativeSensors } from '../src/build/native-sensors'

describe('native sensor builder capability contract', () => {
  it('fails an old builder rather than silently shipping inert config', () => {
    for (const platform of ['ios', 'android'] as const) {
      expect(() => assertCraftSupportsNativeSensors(platform, { pedometer: true }, undefined)).toThrow('pedometer')
      expect(() => assertCraftSupportsNativeSensors(platform, { barometer: true }, [])).toThrow('barometer')
      expect(() => assertCraftSupportsNativeSensors(platform, { pedometer: false }, undefined)).not.toThrow()
      expect(() => assertCraftSupportsNativeSensors(platform, undefined, undefined)).not.toThrow()
      expect(() => assertCraftSupportsNativeSensors(platform, { pedometer: true, barometer: true }, ['pedometer', 'barometer'])).not.toThrow()
    }
  })
  it('requires Android raw motion and iOS background HealthKit on the right host', () => {
    expect(() => assertCraftSupportsNativeSensors('android', { motionSensors: true }, [])).toThrow('motionSensors')
    expect(() => assertCraftSupportsNativeSensors('ios', { motionSensors: true }, undefined)).not.toThrow()
    expect(() => assertCraftSupportsNativeSensors('ios', { healthKitBackground: true }, [])).toThrow('healthKitBackground')
    expect(() => assertCraftSupportsNativeSensors('ios', { healthKitBackground: true }, ['healthKitBackground'])).not.toThrow()
  })
})
