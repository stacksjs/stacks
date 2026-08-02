import type { AppStoreDisplayType, AppStoreSlide } from 'ts-images'
import type { AppStoreDisplay, ImagesConfig } from '@stacksjs/types'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import { APP_STORE_MAX_SCREENSHOTS, generateAppStoreScreenshots } from 'ts-images'
import { loadFonts } from './fonts'
import { background, color, device, markPainter, projectFile, themed } from './theme'

/**
 * Generate the App Store screenshot set a project declares.
 *
 * App Store Connect takes ten screenshots per device class and most listings
 * ship one, because keeping ten in step with the product — across iPhone, iPad
 * and Mac, every release — is not something anyone does by hand twice. Declared
 * as slides, they regenerate from fresh captures whenever the app changes.
 *
 * Returns the paths keyed by display type, which is the shape
 * `extension.safariAppStore.screenshots` takes, so the result can be handed
 * straight to the upload step.
 */
export async function generateAppStoreScreenshotSet(
  images: ImagesConfig,
  root: string = process.cwd(),
): Promise<Partial<Record<AppStoreDisplay, string[]>>> {
  // Explicit opt-in, as with the social cards: a slide list is worthless
  // without a font and captures, and demanding them off the mere presence of
  // the section turns an unrelated build into a failure.
  if (images.appStore?.enabled !== true || !images.appStore.slides?.length)
    return {}

  const appStore = themed(images, images.appStore)
  const declared = images.appStore.slides

  const displays = appStore.displays?.length ? appStore.displays : (['APP_IPHONE_67'] as AppStoreDisplay[])
  const fonts = await loadFonts(images.fonts, root)
  const outputDir = projectFile(appStore.outputDir ?? 'resources/app-store/screenshots', root)
  await mkdir(outputDir, { recursive: true })

  const shared = {
    outputDir,
    titleFont: fonts.title,
    bodyFont: fonts.body,
    brand: appStore.brand,
    drawMark: await markPainter(appStore.mark, root),
    markPlate: appStore.markPlate === false ? undefined : color(appStore.markPlate),
    background: background(appStore.background, root),
    color: color(appStore.color),
    mutedColor: color(appStore.mutedColor),
    device: device(appStore.device),
    layout: appStore.layout,
    format: appStore.format ?? ('png' as const),
    quality: appStore.quality,
  }

  // A slide may opt out of device classes its capture does not suit — a wide
  // dashboard on a 1290x2796 phone frame can only be so large before the slack
  // shows as background. That means the set is not one uniform fan-out, so
  // each class is rendered with the slides that apply to it and the numbering
  // stays contiguous per class, which is what App Store Connect expects.
  const results: Partial<Record<AppStoreDisplay, string[]>> = {}

  for (const display of displays) {
    const slides: AppStoreSlide[] = declared
      .filter(slide => !slide.displays?.length || slide.displays.includes(display))
      .map(slide => ({
        capture: projectFile(slide.capture, root),
        headline: slide.headline,
        subheadline: slide.subheadline,
        background: background(slide.background, root),
      }))

    if (!slides.length)
      continue

    if (slides.length > APP_STORE_MAX_SCREENSHOTS)
      throw new Error(`[image] ${display} has ${slides.length} slides; App Store Connect accepts at most ${APP_STORE_MAX_SCREENSHOTS}`)

    const rendered = await generateAppStoreScreenshots({
      ...shared,
      slides,
      displayTypes: [display as AppStoreDisplayType],
    })

    results[display] = rendered[display] ?? []
  }

  return results
}
