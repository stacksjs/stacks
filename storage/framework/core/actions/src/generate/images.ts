import type { ImageTarget } from '@stacksjs/image'
import { awaitConfig } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'

/**
 * Build the imagery a project declares in `config/images.ts`.
 *
 * Social cards, App Store screenshots and app icons are all downstream of
 * things that change often — a headline, a feature, a logo — and none of them
 * fail loudly when they fall behind. Regenerating them as a build step is the
 * only way they stay true, which is why this is an action and not a snippet in
 * a README.
 */
export interface GenerateImagesActionOptions {
  /** Restrict the run. Defaults to every generator the config enables. */
  only?: ImageTarget[]
  verbose?: boolean
}

export async function generateProjectImages(options: GenerateImagesActionOptions = {}): Promise<void> {
  const config = await awaitConfig()
  const images = config.images

  if (!images || (!images.social?.enabled && !images.appStore?.enabled && !images.appIcons?.enabled)) {
    log.debug('[generate:images] nothing declared in config/images.ts — skipping')
    return
  }

  // Imported lazily: `@stacksjs/image` pulls in the whole ts-images codec
  // stack, which is a lot of module graph for a CLI that mostly does other
  // things.
  const { countGeneratedImages, generateImages } = await import('@stacksjs/image')

  const result = await generateImages(images, { only: options.only, root: projectPath() })
  const counts = countGeneratedImages(result)

  if (options.verbose) {
    for (const card of result.social)
      log.info(`[generate:images] ${card.path} → ${Object.values(card.files).join(', ')}`)
    for (const [display, paths] of Object.entries(result.appStore))
      log.info(`[generate:images] ${display} → ${paths.length} screenshot(s)`)
  }

  const summary = [
    counts.social ? `${counts.social} social card(s)` : '',
    counts.appStore ? `${counts.appStore} App Store screenshot(s)` : '',
    counts.appIcons ? `${counts.appIcons} icon(s)` : '',
  ].filter(Boolean).join(', ')

  if (summary)
    log.success(`Generated ${summary}`)
  else
    log.info('[generate:images] nothing to generate')
}
