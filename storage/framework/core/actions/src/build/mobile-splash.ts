import type { MobileSplash, MobileSplashInput } from '@stacksjs/image'
import { join } from 'node:path'

/**
 * The Craft that takes a generated splash: scaled iOS launch images
 * (`LaunchLogo@2x/@3x.png` into the imageset by scale) and Android 12's
 * splash from `splashResources`. An older one would draw the iOS image at
 * 1x and drop Android's, so the build leaves the colour alone instead.
 */
export const CRAFT_GENERATED_SPLASH_FLOOR = '0.0.443'

export interface MobileSplashLog {
  info: (message: string) => void
  warn: (message: string) => void
}

/**
 * The launch screen files for `buddy build:ios` / `build:android`: the
 * hand-made iOS image as it is, otherwise the ts-images splash preset drawn
 * from `splash.logo` (default the app icon) on the app's own colours.
 */
export async function resolveMobileSplash(
  input: MobileSplashInput,
  outputDir: string,
  root: string,
  craftVersion: string | undefined,
  log: MobileSplashLog,
): Promise<MobileSplash | null> {
  const { platform, splash } = input
  if (splash === false) return null
  const handMade = platform === 'ios' && Boolean(splash?.image)
  if (!handMade && !splash?.logo && !input.appIcon) return null
  if (!handMade && craftVersion && !Bun.semver.satisfies(craftVersion, `>=${CRAFT_GENERATED_SPLASH_FLOOR}`)) {
    log.warn(`The generated launch splash needs craft-native >= ${CRAFT_GENERATED_SPLASH_FLOOR} (installed: ${craftVersion}); the launch screen shows only the background colour. Run \`buddy upgrade\` to raise it to the framework's floor, or give ${platform}.splash.image.`)
    return null
  }
  // Imported lazily: `@stacksjs/image` pulls in the whole ts-images codec.
  const { generateMobileSplash } = await import('@stacksjs/image')
  const result = await generateMobileSplash(input, outputDir, root)
  if (result?.generated)
    log.info(`Generated the ${platform === 'ios' ? 'iOS launch image' : 'Android launch splash'} from ${splash && splash.logo ? `${platform}.splash.logo` : `${platform}.appIcon`} in ${join(outputDir, platform)}`)
  return result
}
