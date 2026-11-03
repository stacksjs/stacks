import { describe, expect, it } from 'bun:test'
import { toCraftIosConfig } from '../src/build/ios-config'
import { toCraftAndroidConfig } from '../src/build/android-config'
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

// Config generation itself must honor the selected builder's advertised surface.
// Otherwise callers can serialize unsupported flags even when build commands guard them.
for (const [platform, convert, sensors] of [
  ['ios', toCraftIosConfig, ['barometer', 'pedometer', 'healthKitBackground']],
  ['android', toCraftAndroidConfig, ['motionSensors', 'barometer', 'pedometer']],
] as const) {
  describe(`${platform} config generation with native sensor support`, () => {
    for (const sensor of sensors) {
      const config = { appName: 'Sensors', bundleId: 'org.stacks.sensors', packageName: 'org.stacks.sensors', capabilities: { [sensor]: true } }
      const flag = `enable${sensor[0]!.toUpperCase()}${sensor.slice(1)}`
      it(`rejects unsupported ${sensor} before generating inert config`, () => {
        expect(() => convert(config)).toThrow(sensor)
      })
      it(`emits ${sensor} only when the selected builder supports it`, () => {
        expect(convert(config, [sensor])[flag]).toBe(true)
        expect(convert({ ...config, capabilities: { [sensor]: false } })[flag]).toBeUndefined()
        expect(convert({ ...config, capabilities: { [sensor]: false } }, [sensor])[flag]).toBe(false)
      })
    }
  })
}
