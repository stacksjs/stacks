import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Resolve generated import targets through package exports, preserving legacy relative files. */
export function resolveModulePath(specifier: string, importerDirectory: string): string {
  if (specifier.startsWith('file:')) return fileURLToPath(specifier)
  if (specifier.startsWith('.') || isAbsolute(specifier)) return resolve(importerDirectory, specifier)
  // Scoped names are unambiguously packages; a broken export must not silently
  // turn into a path beneath the generated registry.
  if (specifier.startsWith('@')) return Bun.resolveSync(specifier, importerDirectory)
  const local = resolve(importerDirectory, specifier)
  // Older registries may contain a bare filename rather than ./filename.
  if (existsSync(local)) return local
  return Bun.resolveSync(specifier, importerDirectory)
}
