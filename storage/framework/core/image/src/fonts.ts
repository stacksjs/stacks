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

export async function loadFonts(fonts: ImageFontConfig | undefined, root: string = process.cwd()): Promise<ResolvedFonts> {
  if (!fonts?.title) {
    throw new Error(
      '[image] No font configured. Set `images.fonts.title` in config/images.ts to a TrueType (.ttf) file - '
      + 'generated cards and screenshots draw real glyphs and cannot fall back to a system face.',
    )
  }

  const title = loadFont(new Uint8Array(await readFile(resolveFontPath(fonts.title, root))))
  const body = fonts.body
    ? loadFont(new Uint8Array(await readFile(resolveFontPath(fonts.body, root))))
    : title

  return { title, body }
}
