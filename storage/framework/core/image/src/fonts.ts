import type { Font } from 'ts-images'
import type { ImageFontConfig } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { loadFont } from 'ts-images'

/**
 * Resolve the faces the generators draw with.
 *
 * The renderer reads TrueType outlines directly — no browser, no system font
 * stack — so the face has to be a file the project actually ships or depends
 * on. Reaching for whatever the machine happens to have installed would make
 * a card render differently in CI than on a laptop, which is worse than not
 * rendering at all.
 *
 * A configured value may be a project-relative path or a module specifier, so
 * a font that arrives as a dependency (`@expo-google-fonts/inter/Inter_700Bold
 * .ttf`) works without vendoring the binary into the repository.
 */
export interface ResolvedFonts {
  title: Font
  body: Font
}

export function resolveFontPath(value: string, root: string = process.cwd()): string {
  if (isAbsolute(value))
    return value

  const local = resolve(root, value)
  if (existsSync(local))
    return local

  // Not on disk relative to the project: try it as a module specifier, which
  // is how a font installed as a dependency is named.
  try {
    return Bun.resolveSync(value, root)
  }
  catch {
    throw new Error(
      `[image] Font not found: ${value}\n`
      + `Looked for ${local} and for a module resolvable from ${root}.\n`
      + `Set \`images.fonts.title\` in config/images.ts to a TrueType (.ttf) file. `
      + `OpenType/CFF (.otf) and WOFF2 are not TrueType outlines and cannot be read.`,
    )
  }
}

/**
 * Characters a title face has to be able to draw.
 *
 * Common Latin letters and digits, which is what a card headline is made of.
 * Deliberately not exhaustive: the question is "does this face draw anything at
 * all", not "does it cover your copy", and a face missing one accented
 * character should not be refused.
 */
const SAMPLE_CHARACTERS = 'AaEeHhNnOoRrSsTt0123'

/**
 * Whether a loaded face actually produces outlines.
 *
 * A face can load without error, report a glyph for every character, and draw
 * nothing - which writes a card of the right dimensions with a background and
 * no text, reports success, and exits 0. The failure is invisible in exactly
 * the situation the feature exists for, because nobody looks at their own
 * og:image (stacksjs/stacks#2575).
 *
 * The check has to reach the outlines, and it is worth saying why rather than
 * leaving it to look like belt and braces. The face that prompted this -
 * `Monaco.ttf`, which this repository used to ship in the obvious place to
 * point `images.fonts.title` at, and no longer does - mapped all 20 sample
 * characters to a glyph id and returned an **empty contour list for every one
 * of them**: 6 glyphs, no drawable Latin. A cmap check passes that.
 */
export function drawsGlyphs(font: Font): boolean {
  for (const character of SAMPLE_CHARACTERS) {
    const glyphId = font.glyphIdFor(character.codePointAt(0)!)
    if (glyphId > 0 && font.outline(glyphId).some(contour => contour.length > 0))
      return true
  }

  return false
}

function loadDrawableFont(bytes: Uint8Array, path: string, option: 'title' | 'body'): Font {
  const font = loadFont(bytes)

  if (!drawsGlyphs(font)) {
    throw new Error(
      `[image] Font draws no glyphs: ${path}\n`
      + `It loaded, and it reports ${font.glyphCount} glyph(s), but every outline for `
      + `common Latin characters is empty - a card drawn with it would be a background `
      + `and no text, written successfully and silently wrong.\n`
      + `Set \`images.fonts.${option}\` in config/images.ts to a TrueType face with `
      + `drawable outlines. Bitmap-only faces and .ttf files wrapping OpenType/CFF `
      + `outlines both look like this.`,
    )
  }

  return font
}

export async function loadFonts(fonts: ImageFontConfig | undefined, root: string = process.cwd()): Promise<ResolvedFonts> {
  if (!fonts?.title) {
    throw new Error(
      '[image] No font configured. Set `images.fonts.title` in config/images.ts to a TrueType (.ttf) file - '
      + 'generated cards and screenshots draw real glyphs and cannot fall back to a system face.',
    )
  }

  const titlePath = resolveFontPath(fonts.title, root)
  const title = loadDrawableFont(new Uint8Array(await readFile(titlePath)), titlePath, 'title')

  let body = title
  if (fonts.body) {
    const bodyPath = resolveFontPath(fonts.body, root)
    body = loadDrawableFont(new Uint8Array(await readFile(bodyPath)), bodyPath, 'body')
  }

  return { title, body }
}
