import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { createImageData, encode } from 'ts-images'
import { CRAFT_GENERATED_SPLASH_FLOOR, resolveMobileSplash } from '../src/build/mobile-splash'

let root = ''
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = ''
})

async function app(): Promise<string> {
  root = mkdtempSync(join(tmpdir(), 'stacks-mobile-splash-'))
  writeFileSync(join(root, 'icon.png'), await encode(createImageData(128, 128, { fill: { r: 17, g: 76, b: 254 } }), 'png'))
  writeFileSync(join(root, 'launch.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="47"/>')
  return root
}

function recorder() {
  const lines: string[] = []
  return { lines, log: { info: (line: string) => lines.push(`info ${line}`), warn: (line: string) => lines.push(`warn ${line}`) } }
}

describe('resolveMobileSplash', () => {
  it('generates the iOS launch image from the app icon by default', async () => {
    const dir = await app()
    const { lines, log } = recorder()
    const splash = await resolveMobileSplash({ platform: 'ios', appIcon: 'icon.png', backgroundColor: '#f2f2f7', backgroundColorDark: '#000000' }, join(dir, 'splash'), dir, CRAFT_GENERATED_SPLASH_FLOOR, log)
    expect(splash?.image).toBe(join(dir, 'splash/ios/LaunchLogo.imageset/LaunchLogo.png'))
    expect(existsSync(join(dir, 'splash/ios/LaunchLogo.imageset/LaunchLogo@3x.png'))).toBe(true)
    expect(readFileSync(splash!.imageDark!).subarray(1, 4).toString()).toBe('PNG')
    expect(lines).toEqual([`info Generated the iOS launch image from ios.appIcon in ${join(dir, 'splash/ios')}`])
  })

  it('generates Android resources from splash.logo', async () => {
    const dir = await app()
    const { lines, log } = recorder()
    const splash = await resolveMobileSplash({ platform: 'android', appIcon: 'missing.png', splash: { logo: 'icon.png' }, backgroundColor: '#000000' }, join(dir, 'splash'), dir, '0.0.450', log)
    expect(splash?.resources).toBe(join(dir, 'splash/android/res'))
    expect(existsSync(join(dir, 'splash/android/res/drawable-mdpi/splash_icon.png'))).toBe(true)
    expect(lines[0]).toStartWith('info Generated the Android launch splash from android.splash.logo')
  })

  it('leaves the colour alone on a Craft that cannot install a generated splash', async () => {
    const dir = await app()
    const { lines, log } = recorder()
    expect(await resolveMobileSplash({ platform: 'android', appIcon: 'icon.png' }, join(dir, 'splash'), dir, '0.0.436', log)).toBeNull()
    expect(existsSync(join(dir, 'splash'))).toBe(false)
    expect(lines[0]).toContain(`craft-native >= ${CRAFT_GENERATED_SPLASH_FLOOR} (installed: 0.0.436)`)
  })

  it('passes a hand-made iOS image through on any Craft, and stays off when asked', async () => {
    const dir = await app()
    const { lines, log } = recorder()
    expect(await resolveMobileSplash({ platform: 'ios', appIcon: 'icon.png', splash: { image: 'launch.svg', imageDark: 'launch.svg' } }, join(dir, 'splash'), dir, '0.0.424', log))
      .toEqual({ image: join(dir, 'launch.svg'), imageDark: join(dir, 'launch.svg'), generated: false })
    expect(await resolveMobileSplash({ platform: 'ios', appIcon: 'icon.png', splash: false }, join(dir, 'splash'), dir, '0.0.450', log)).toBeNull()
    expect(await resolveMobileSplash({ platform: 'ios' }, join(dir, 'splash'), dir, '0.0.450', log)).toBeNull()
    expect(lines).toEqual([])
  })
})
