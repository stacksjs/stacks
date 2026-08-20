import type { ImageData, RGBA, SurfaceBackground } from 'ts-images'
import type { ImageBackgroundConfig, ImageColor, ImageDeviceConfig, ImagesConfig } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { decode, drawImage, parseColor } from 'ts-images'

/**
 * Turn the declarative half of `config/images.ts` into the shapes ts-images
 * takes.
 *
 * Configuration carries colours as strings and paths as project-relative, both
 * of which have to become something concrete before a pixel is drawn. Doing it
 * in one place means the three generators agree on what `background` means,
 * which is the point of having a shared palette at all.
 */

export function projectFile(path: string, root: string = process.cwd()): string {
  return isAbsolute(path) ? path : resolve(root, path)
}

/**
 * Resolve a configured asset, failing with something a person can act on.
 *
 * These paths point at things a build step produced — a capture of a running
 * app, an exported logo — so the common failure is not a typo but an ordering
 * mistake: generate before capture, or after a clean that wiped the captures.
 * Left to the codec, that surfaces as a bare ENOENT under ten frames of stack
 * with no mention of which slide or which config key is at fault.
 */
export function requireProjectFile(path: string, root: string, describe: string): string {
  const resolved = projectFile(path, root)
  if (!existsSync(resolved))
    throw new Error(`[image] ${describe} not found: ${path}\nLooked in ${resolved}. Capture it before generating - \`buddy generate:images\` frames existing captures, it does not take them.`)

  return resolved
}

export function color(value: ImageColor | undefined): RGBA | undefined {
  return value === undefined ? undefined : parseColor(value)
}

export function background(value: ImageBackgroundConfig | undefined, root: string = process.cwd()): SurfaceBackground | undefined {
  if (!value)
    return undefined

  return {
    color: color(value.color),
    gradient: value.gradient && {
      angle: value.gradient.angle,
      stops: value.gradient.stops.map(stop => ({ offset: stop.offset, color: parseColor(stop.color) })),
    },
    glows: value.glows?.map(glow => ({ ...glow, color: parseColor(glow.color) })),
    image: value.image ? projectFile(value.image, root) : undefined,
  }
}

/**
 * `shadow` is tri-state in configuration and in the renderer: absent means
 * "the default shadow", `false` means "none", and an object means "this one".
 * `undefined` cannot express the middle case, so the translation is explicit.
 */
export function device(value: ImageDeviceConfig | undefined): {
  radius?: number
  borderColor?: RGBA
  scale?: number
  shadow?: { blur?: number, offsetX?: number, offsetY?: number, spread?: number, color?: RGBA }
} | undefined {
  if (!value)
    return undefined

  return {
    radius: value.radius,
    scale: value.scale,
    borderColor: color(value.borderColor),
    shadow: value.shadow === false
      ? undefined
      : { ...(value.shadow ?? {}), color: color(value.shadow?.color) },
  }
}

/**
 * Build a `drawMark` callback from an image path.
 *
 * ts-images hands back a box and lets the caller paint the mark, because a
 * library cannot know what a brand's mark looks like. For a Stacks project it
 * is nearly always a file already in the repository — the app icon — so the
 * callback is just a placement.
 */
export interface MarkPainter {
  draw: (canvas: ImageData, box: { x: number, y: number, size: number, width?: number }) => void
  /** Width divided by height, so the card can reserve the right box. */
  aspect: number
}

export async function markPainter(
  path: string | undefined,
  root: string = process.cwd(),
): Promise<MarkPainter | undefined> {
  if (!path)
    return undefined

  const mark = await decode(new Uint8Array(await readFile(projectFile(path, root))))

  /*
   * Keep the mark's own proportions rather than fitting it inside a square.
   *
   * `fit: 'contain'` in a square box is right for an icon and wrong for a
   * wordmark: a 2:1 logo comes out at half the box height, so the one asset
   * that carries the brand renders smaller than the text beside it. Scaling
   * off the height instead means a square mark is unchanged and a wide one
   * fills the height and takes the width it needs.
   */
  const aspect = mark.height > 0 ? mark.width / mark.height : 1

  return {
    aspect,
    draw: (canvas, box) => {
      drawImage(canvas, mark, {
        x: box.x,
        y: box.y,
        // The card reserves the width from `aspect` and passes it back; fall
        // back to computing it for a caller that does not.
        width: box.width ?? box.size * aspect,
        height: box.size,
        fit: 'contain',
      })
    },
  }
}

/** The palette keys a generator inherits from the top level of the config. */
export interface ImageTheme {
  background?: ImageBackgroundConfig
  color?: ImageColor
  mutedColor?: ImageColor
  accent?: ImageColor
  device?: ImageDeviceConfig
  brand?: string
  mark?: string
  markPlate?: false | ImageColor
}

/** Fold the shared palette into a generator's own, letting the generator win. */
export function themed<T extends ImageTheme>(images: ImagesConfig, section: T | undefined): T & ImageTheme {
  return {
    ...(section ?? {} as T),
    background: section?.background ?? images.background,
    color: section?.color ?? images.color,
    mutedColor: section?.mutedColor ?? images.mutedColor,
    // `accent` is declared on ImagesConfig as part of the shared palette, so
    // leaving it out here made it inert: a project that set one at the top
    // level got the card renderer's built-in orange and no way to tell why.
    accent: section?.accent ?? images.accent,
    device: section?.device ?? images.device,
    brand: section?.brand ?? images.brand,
    mark: section?.mark ?? images.mark,
    // `?? undefined` would swallow a deliberate `false`, which is the whole
    // point of the option: draw the mark with nothing behind it.
    markPlate: section?.markPlate !== undefined ? section.markPlate : images.markPlate,
  }
}
