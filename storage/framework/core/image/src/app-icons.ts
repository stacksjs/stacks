import type { AppIconResult, FaviconResult } from 'ts-images'
import type { ImagesConfig } from '@stacksjs/types'
import process from 'node:process'
import { generateAppIcons, generateFavicons } from 'ts-images'
import { projectFile, requireProjectFile } from './theme'

/**
 * Generate the platform icon sets from one square source.
 *
 * The failure mode this removes is an icon set that is complete on the day it
 * is made and incomplete forever after: Apple adds a size, the favicon set
 * misses the one format a browser wants, and nobody notices because each file
 * was placed by hand. From one source, all of them regenerate together.
 */
export interface AppIconSetResult {
  icons: AppIconResult[]
  favicons: FaviconResult[]
}

export async function generateAppIconSet(
  images: ImagesConfig,
  root: string = process.cwd(),
): Promise<AppIconSetResult> {
  const appIcons = images.appIcons
  if (appIcons?.enabled !== true || !appIcons.source)
    return { icons: [], favicons: [] }

  const source = requireProjectFile(appIcons.source, root, 'App icon source')

  /*
   * An explicit `[]` means no platform icon sets at all.
   *
   * It used to fall through to "both", because the check was on length rather
   * than on presence - so a web project that wanted the favicons and said so
   * by asking for no platforms got an iOS and a macOS asset catalog it had no
   * use for, and no way to decline them short of leaving `appIcons` off and
   * losing the favicons with it.
   */
  const platforms = appIcons.platforms ?? (['ios', 'macos'] as const)

  const icons = platforms.length === 0
    ? []
    : await generateAppIcons(source, {
        outputDir: projectFile(appIcons.outputDir ?? 'resources/app-icons', root),
        // ts-images takes one platform or 'all'; asking for both is 'all'.
        platform: platforms.length === 1 ? platforms[0] : 'all',
      })

  const favicons = appIcons.favicon
    ? await generateFavicons(source, projectFile(appIcons.faviconDir ?? 'public', root), {
        /*
         * Forwarded rather than left to the renderer's defaults, which name
         * the application "App" and paint it a colour belonging to no brand -
         * values a project could previously only correct by rewriting the
         * manifest after every build.
         *
         * `brand` is the fallback for the name because it is already the one
         * word this config uses for the product, on every generated card.
         */
        manifest: appIcons.manifest === false
          ? false
          : { name: images.brand, ...(appIcons.manifest ?? {}) },
      })
    : []

  return { icons, favicons }
}
