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
  const platforms = appIcons.platforms?.length ? appIcons.platforms : (['ios', 'macos'] as const)

  const icons = await generateAppIcons(source, {
    outputDir: projectFile(appIcons.outputDir ?? 'resources/app-icons', root),
    // ts-images takes one platform or 'all'; asking for both is 'all'.
    platform: platforms.length === 1 ? platforms[0] : 'all',
  })

  const favicons = appIcons.favicon
    ? await generateFavicons(source, projectFile(appIcons.faviconDir ?? 'public', root))
    : []

  return { icons, favicons }
}
