import type { AppStoreDisplay, ImagesConfig } from '@stacksjs/types'
import type { AppIconSetResult } from './app-icons'
import type { SocialCardResult } from './social'
import process from 'node:process'
import { generateAppIconSet } from './app-icons'
import { generateAppStoreScreenshotSet } from './app-store'
import { generateSocialCardSet } from './social'

/**
 * Run every image generator a project has declared.
 *
 * The three are independent — a site with cards has no App Store listing, an
 * app with a listing may not have a marketing site — so each is skipped
 * silently when it is not configured. What they share is the reason for
 * existing at all: generated imagery goes stale without anyone noticing,
 * because nothing fails when it does.
 */
export type ImageTarget = 'social' | 'app-store' | 'app-icons'

export interface GenerateImagesResult {
  social: SocialCardResult[]
  appStore: Partial<Record<AppStoreDisplay, string[]>>
  appIcons: AppIconSetResult
}

export interface GenerateImagesOptions {
  /** Restrict the run to these generators. Defaults to all of them. */
  only?: ImageTarget[]
  /** Project root. Defaults to the working directory. */
  root?: string
}

export async function generateImages(
  images: ImagesConfig,
  options: GenerateImagesOptions = {},
): Promise<GenerateImagesResult> {
  const root = options.root ?? process.cwd()
  const wanted = (target: ImageTarget): boolean => !options.only?.length || options.only.includes(target)

  return {
    social: wanted('social') ? await generateSocialCardSet(images, root) : [],
    appStore: wanted('app-store') ? await generateAppStoreScreenshotSet(images, root) : {},
    appIcons: wanted('app-icons') ? await generateAppIconSet(images, root) : { icons: [], favicons: [] },
  }
}

/** Count what a run produced, for a one-line summary on the CLI. */
export function countGeneratedImages(result: GenerateImagesResult): { social: number, appStore: number, appIcons: number } {
  return {
    social: result.social.reduce((total, card) => total + Object.keys(card.files).length, 0),
    appStore: Object.values(result.appStore).reduce((total, paths) => total + (paths?.length ?? 0), 0),
    appIcons: result.appIcons.icons.reduce((total, set) => total + set.sizes.length, 0) + result.appIcons.favicons.length,
  }
}
