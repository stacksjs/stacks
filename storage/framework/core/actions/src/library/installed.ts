import { verifyInstalledFiles } from './installed-internal.js'

export interface InstalledLibraryPackageOptions {
  /** Optional consumer directory containing the installed package. */
  consumerRoot?: string
  /** Accept only a root .bun-tag regular file containing a SHA-512 SRI. */
  allowBunTag?: boolean
  /** Counts directories and installer metadata too. Default: 100,000. */
  maxEntries?: number
  /** Maximum nested directory depth. Default: 128. */
  maxDepth?: number
  /** Maximum total file bytes read. Default: 256 MiB. */
  maxBytes?: number
  /** Maximum individual file size. Defaults to maxBytes. */
  maxFileBytes?: number
}

/**
 * Inspect a stable, caller-owned installation against libraryArchiveEntries().
 * Returns every actual package file only after complete key-set/byte equality.
 * Rejects links, special files, unsafe paths and budget overruns. Optional Bun
 * installer metadata is checked and omitted from the returned archive payload.
 * This verifies local bytes, not registry/source ownership or concurrent writers.
 */
export function inspectInstalledLibraryPackage(directory: string, expected: ReadonlyMap<string, Uint8Array>, options: InstalledLibraryPackageOptions = {}): Map<string, Uint8Array> {
  return verifyInstalledFiles(directory, expected, options)
}
