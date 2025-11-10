/**
 * Export size calculation (export-size replacement)
 *
 * Calculate the size of exported modules
 */

import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { formatBytes } from './bytes'

export interface ExportSize {
  /** Export name */
  name: string
  /** Size in bytes */
  size: number
  /** Human-readable size */
  readable: string
}

export interface PackageExportsSizeResult {
  /** Total size in bytes */
  totalSize: number
  /** Human-readable total size */
  totalReadable: string
  /** Individual export sizes */
  exports: ExportSize[]
}

/**
 * Get the size of a file
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath)
    return stats.size
  }
  catch {
    return 0
  }
}

/**
 * Get sizes of all exports in a package
 *
 * @example
 * ```ts
 * const sizes = await getExportsSize('./dist')
 * console.log(sizes.totalReadable) // "42.5 KB"
 * ```
 */
export async function getExportsSize(distPath: string): Promise<PackageExportsSizeResult> {
  const exports: ExportSize[] = []
  let totalSize = 0

  try {
    // Read directory and get all .js files
    const files = await getAllJsFiles(distPath)

    for (const file of files) {
      const size = await getFileSize(file.path)
      totalSize += size

      exports.push({
        name: file.name,
        size,
        readable: formatBytes(size),
      })
    }
  }
  catch (error) {
    // If directory doesn't exist or can't be read, return empty result
  }

  return {
    totalSize,
    totalReadable: formatBytes(totalSize),
    exports: exports.sort((a, b) => b.size - a.size), // Sort by size descending
  }
}

interface FileInfo {
  name: string
  path: string
}

async function getAllJsFiles(dir: string): Promise<FileInfo[]> {
  const files: FileInfo[] = []

  try {
    const entries = await Bun.$.throws(false)`find ${dir} -type f \\( -name "*.js" -o -name "*.mjs" -o -name "*.cjs" \\)`.text()

    for (const entry of entries.split('\n').filter(Boolean)) {
      const name = entry.replace(dir, '').replace(/^\//, '')
      files.push({ name, path: entry })
    }
  }
  catch {
    // Directory doesn't exist or error reading
  }

  return files
}

/**
 * Get gzipped size estimate
 */
export function estimateGzipSize(size: number): number {
  // Rough estimate: gzip typically achieves 70-80% compression for JS
  return Math.floor(size * 0.3)
}

/**
 * Get brotli size estimate
 */
export function estimateBrotliSize(size: number): number {
  // Rough estimate: brotli typically achieves 75-85% compression for JS
  return Math.floor(size * 0.25)
}

/**
 * Format export sizes as a table
 */
export function formatExportSizes(result: PackageExportsSizeResult): string {
  if (result.exports.length === 0) {
    return 'No exports found'
  }

  const lines = ['Export Sizes:', '']

  // Find longest name for padding
  const maxNameLength = Math.max(...result.exports.map(e => e.name.length))

  for (const exp of result.exports) {
    const name = exp.name.padEnd(maxNameLength, ' ')
    lines.push(`  ${name}  ${exp.readable}`)
  }

  lines.push('')
  lines.push(`Total: ${result.totalReadable}`)
  lines.push(`Estimated gzipped: ${formatBytes(estimateGzipSize(result.totalSize))}`)
  lines.push(`Estimated brotli: ${formatBytes(estimateBrotliSize(result.totalSize))}`)

  return lines.join('\n')
}

export { getExportsSize as default }
