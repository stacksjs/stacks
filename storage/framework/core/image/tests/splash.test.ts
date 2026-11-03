import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createImageData, encode, getMetadata } from 'ts-images'
import { generateMobileSplash, mobileSplashOptions } from '../src/splash'

let root: string

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'stacks-splash-'))
  mkdirSync(join(root, 'public'), { recursive: true })
  const icon = createImageData(256, 256)
  icon.data.fill(255)
  for (let i = 0; i < icon.data.length; i += 4) icon.data[i + 1] = 40
  writeFileSync(join(root, 'public/icon.png'), await encode(icon, 'png'))
  writeFileSync(join(root, 'public/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60"><rect width="200" height="60" fill="#dd0f15"/></svg>')
  writeFileSync(join(root, 'public/launch.png'), await encode(createImageData(10, 10), 'png'))
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('mobileSplashOptions', () => {
  test('defaults to the app icon, masked to its corners, on the app background', () => {
    const options = mobileSplashOptions({ platform: 'ios', appIcon: 'public/icon.png', backgroundColor: '#f2f2f7', tintColor: '#114cfe' }, root)
    expect(options).toEqual({
      logo: join(root, 'public/icon.png'),
      light: { background: '#f2f2f7' },
      dark: false,
      shape: 'rounded',
      platforms: ['ios'],
      accent: '#114cfe',
    })
  })

  test('a logo is drawn unmasked, with text, a dark appearance and its own accent', () => {
    const options = mobileSplashOptions({
      platform: 'android',
      appIcon: 'public/icon.png',
      backgroundColor: '#ffffff',
      backgroundColorDark: '#000000',
      tintColor: '#114cfe',
      splash: { logo: 'public/logo.svg', accent: '#dd0f15', text: 'Last Soul Ultra', font: 'public/logo.svg', uppercase: true, size: 80 },
    }, root)
    expect(options?.shape).toBe('none')
    expect(options?.dark).toEqual({ background: '#000000' })
    expect(options?.accent).toBe('#dd0f15')
    expect(options?.size).toBe(80)
    expect(options?.platforms).toEqual(['android'])
    expect(options?.text).toEqual({ value: 'Last Soul Ultra', font: join(root, 'public/logo.svg'), uppercase: true })
  })

  test('the background Craft paints when the app gives none, and no glow on request', () => {
    const options = mobileSplashOptions({ platform: 'ios', appIcon: 'public/icon.png', tintColor: '#114cfe', splash: { accent: false } }, root)
    expect(options?.light).toEqual({ background: '#000000' })
    expect(options?.accent).toBeUndefined()
    expect(options?.glow).toBe(false)
  })

  test('nothing to generate: off, hand-made on iOS, or no logo at all', () => {
    expect(mobileSplashOptions({ platform: 'ios', appIcon: 'public/icon.png', splash: false }, root)).toBeNull()
    expect(mobileSplashOptions({ platform: 'ios', appIcon: 'public/icon.png', splash: { image: 'public/launch.png' } }, root)).toBeNull()
    expect(mobileSplashOptions({ platform: 'ios' }, root)).toBeNull()
    // A hand-made image is iOS-only: Android still draws from the icon.
    expect(mobileSplashOptions({ platform: 'android', appIcon: 'public/icon.png', splash: { image: 'public/launch.png' } }, root)?.logo).toBe(join(root, 'public/icon.png'))
  })

  test('says which key is wrong', () => {
    expect(() => mobileSplashOptions({ platform: 'ios', appIcon: 'public/missing.png' }, root)).toThrow('ios.appIcon (the default ios.splash.logo) not found')
    expect(() => mobileSplashOptions({ platform: 'ios', appIcon: 'public/icon.png', splash: { text: 'HQ' } }, root)).toThrow('ios.splash.text needs ios.splash.font')
    expect(() => mobileSplashOptions({ platform: 'ios', appIcon: 'public/icon.png', backgroundColor: 'red' }, root)).toThrow('ios.backgroundColor must be a #RRGGBB')
    expect(() => mobileSplashOptions({ platform: 'android', appIcon: 'public/icon.png', splash: { size: 0 } }, root)).toThrow('android.splash.size')
  })
})

describe('generateMobileSplash', () => {
  test('writes the iOS launch image at 1x/2x/3x, light and dark', async () => {
    const out = join(root, 'out')
    const splash = await generateMobileSplash({ platform: 'ios', appIcon: 'public/icon.png', backgroundColor: '#ffffff', backgroundColorDark: '#000000' }, out, root)
    expect(splash?.generated).toBe(true)
    expect(splash?.image).toBe(join(out, 'ios/LaunchLogo.imageset/LaunchLogo.png'))
    expect(splash?.imageDark).toBe(join(out, 'ios/LaunchLogo.imageset/LaunchLogo-dark.png'))
    const one = await getMetadata(readFileSync(join(out, 'ios/LaunchLogo.imageset/LaunchLogo.png')))
    const three = await getMetadata(readFileSync(join(out, 'ios/LaunchLogo.imageset/LaunchLogo@3x.png')))
    expect(three.width).toBe(one.width * 3)
    expect(three.height).toBe(one.height * 3)
  })

  test('writes Android resources and leaves no stale Dark Mode set behind', async () => {
    const out = join(root, 'out')
    await generateMobileSplash({ platform: 'android', appIcon: 'public/icon.png', backgroundColor: '#ffffff', backgroundColorDark: '#000000' }, out, root)
    expect(existsSync(join(out, 'android/res/drawable-night-xxhdpi/splash_icon.png'))).toBe(true)
    const splash = await generateMobileSplash({ platform: 'android', appIcon: 'public/icon.png', backgroundColor: '#ffffff' }, out, root)
    expect(splash?.resources).toBe(join(out, 'android/res'))
    expect(existsSync(join(out, 'android/res/drawable-xxhdpi/splash_icon.png'))).toBe(true)
    expect(existsSync(join(out, 'android/res/drawable-xxhdpi/splash_logo.png'))).toBe(true)
    expect(existsSync(join(out, 'android/res/drawable-night-xxhdpi/splash_icon.png'))).toBe(false)
  })

  test('a hand-made iOS image is used as it is', async () => {
    const splash = await generateMobileSplash({ platform: 'ios', appIcon: 'public/icon.png', splash: { image: 'public/launch.png' } }, join(root, 'out/hand'), root)
    expect(splash).toEqual({ image: join(root, 'public/launch.png'), imageDark: undefined, generated: false })
    expect(existsSync(join(root, 'out/hand'))).toBe(false)
  })
})
