/**
 * Where the zig-waf shared library is.
 *
 * Named, never guessed: `security.waf.library` first, then the
 * `ZIG_WAF_LIBRARY` environment variable. Searching sibling checkouts or the
 * system loader path would load whichever build happened to be lying around,
 * which is the wrong failure for a security control.
 */

import { existsSync } from 'node:fs'
import process from 'node:process'

export function libraryFileName(platform: string = process.platform): string {
  return platform === 'darwin' ? 'libzig-waf.dylib' : platform === 'win32' ? 'zig-waf.dll' : 'libzig-waf.so'
}

export function findWafLibrary(configured?: string, env: Record<string, string | undefined> = process.env): string {
  const candidate = configured || env.ZIG_WAF_LIBRARY
  if (!candidate)
    throw new Error(`The in-process WAF needs zig-waf's shared library (${libraryFileName()}). Set security.waf.library or ZIG_WAF_LIBRARY to its path: it is in lib/ of a zig-waf release, or zig-out/lib/ after \`zig build\` in a zig-waf checkout.`)
  if (!existsSync(candidate))
    throw new Error(`zig-waf's shared library is not at ${candidate} (from ${configured ? 'security.waf.library' : 'ZIG_WAF_LIBRARY'}).`)
  return candidate
}
