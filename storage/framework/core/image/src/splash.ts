import type { SplashOptions, SplashScreenResult } from 'ts-images'
import type { MobileSplashConfig } from '@stacksjs/types'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { generateSplashScreens } from 'ts-images'
import { projectFile } from './theme'

function requireProjectFile(path: string, root: string, key: string): string {
  const resolved = projectFile(path, root)
  if (!existsSync(resolved)) throw new Error(`[image] ${key} not found: ${path} (looked in ${resolved})`)
  return resolved
}

/**
 * A native app's launch screen, generated from its brand.
 *
 * A Stacks app gets one without asking: `buddy build:ios` and
 * `build:android` render the app icon (or `splash.logo`) with ts-images'
 * splash preset, at every scale the platform needs, on the colour the app's
 * launch screen paints. A hand-made launch image is the exception, not a
 * prerequisite.
 */
export interface MobileSplashInput {
  platform: 'ios' | 'android'
  splash?: MobileSplashConfig | false
  appIcon?: string
  backgroundColor?: string
  backgroundColorDark?: string
  /** The brand colour the glow defaults to (iOS `tintColor`). */
  tintColor?: string
}

/** What the build hands Craft. */
export interface MobileSplash {
  /** iOS: the launch image (`LaunchLogo.png`, `@2x`/`@3x` beside a generated one). */
  image?: string
  imageDark?: string
  /** Android: a res-shaped directory of `splash_icon.png` / `splash_logo.png`. */
  resources?: string
  /** Whether the files came from the preset rather than by hand. */
  generated: boolean
}

/** Craft paints this when an app gives no background colour, so the splash is drawn for it too. */
const CRAFT_DEFAULT_BACKGROUND = '#000000'

const HEX = /^#[0-9a-f]{6}$/i

/**
 * The preset's options for an app's splash config, or `null` when there is
 * nothing to generate: the splash is off, it is hand-made, or the app has
 * neither a logo nor an icon to draw.
 */
export function mobileSplashOptions(input: MobileSplashInput, root: string = process.cwd()): SplashOptions | null {
  const { platform, splash } = input
  if (splash === false) return null
  if (platform === 'ios' && splash?.image) return null
  const source = splash?.logo ?? input.appIcon
  if (!source) return null
  const key = `${platform}.splash`
  const logo = requireProjectFile(source, root, splash?.logo ? `${key}.logo` : `${platform}.appIcon (the default ${key}.logo)`)
  const logoDark = splash?.logoDark ? requireProjectFile(splash.logoDark, root, `${key}.logoDark`) : undefined

  for (const [name, value] of [['backgroundColor', input.backgroundColor], ['backgroundColorDark', input.backgroundColorDark], [`splash.accent`, splash?.accent || undefined]] as const) {
    if (value !== undefined && !HEX.test(value)) throw new Error(`${platform}.${name} must be a #RRGGBB colour for the generated splash, not ${String(value)}`)
  }
  if (splash?.text !== undefined && !splash.font) throw new Error(`${key}.text needs ${key}.font: the .ttf to set it in`)
  if (splash?.size !== undefined && !(splash.size > 0)) throw new Error(`${key}.size must be a positive number of points`)

  const background = input.backgroundColor ?? CRAFT_DEFAULT_BACKGROUND
  // Craft paints one colour in both appearances unless the app gives a dark
  // one, so a dark splash is drawn only when it would look different.
  const dark = input.backgroundColorDark || logoDark
    ? { background: input.backgroundColorDark ?? background, ...(logoDark ? { logo: logoDark } : {}) }
    : false
  const accent = splash?.accent === false ? undefined : splash?.accent ?? input.tintColor

  const options: SplashOptions = {
    logo,
    light: { background },
    dark,
    // The app icon is a full-bleed square: masked to an icon's corners it
    // reads as the icon the person just tapped.
    shape: splash?.shape ?? (splash?.logo ? 'none' : 'rounded'),
    platforms: [platform],
  }
  if (accent) options.accent = accent
  if (splash?.accent === false) options.glow = false
  if (splash?.size !== undefined) options.size = splash.size
  if (splash?.text) {
    options.text = {
      value: splash.text,
      font: requireProjectFile(splash.font!, root, `${key}.font`),
      ...(splash.uppercase ? { uppercase: true } : {}),
    }
  }
  return options
}

/**
 * The launch screen files for one platform: the hand-made image when the
 * app gives one, the preset's otherwise, written to `<outputDir>/<platform>`.
 */
export async function generateMobileSplash(input: MobileSplashInput, outputDir: string, root: string = process.cwd()): Promise<MobileSplash | null> {
  const { platform, splash } = input
  if (splash === false) return null
  if (platform === 'ios' && splash?.image) {
    return {
      image: requireProjectFile(splash.image, root, 'ios.splash.image'),
      imageDark: splash.imageDark ? requireProjectFile(splash.imageDark, root, 'ios.splash.imageDark') : undefined,
      generated: false,
    }
  }
  const options = mobileSplashOptions(input, root)
  if (!options) return null
  // The preset writes `<outputDir>/<platform>`, fresh each build: Craft
  // installs every splash file it finds, so a Dark Mode set from an earlier
  // config must not linger.
  rmSync(join(outputDir, platform), { recursive: true, force: true })
  const result: SplashScreenResult = await generateSplashScreens(options, outputDir)
  return platform === 'ios'
    ? { image: result.ios?.image, imageDark: result.ios?.imageDark, generated: true }
    : { resources: result.android?.resources, generated: true }
}
