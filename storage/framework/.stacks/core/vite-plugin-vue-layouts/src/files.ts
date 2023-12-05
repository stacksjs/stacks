import { glob } from 'stacks:storage'
import type { ResolvedOptions } from './types'
import { debug, extensionsToGlob } from './utils'

/**
 * Resolves the files that are valid pages for the given context.
 */
export async function getFilesFromPath(path: string, options: ResolvedOptions): Promise<string[]> {
  const {
    exclude,
    extensions,
  } = options

  const ext = extensionsToGlob(extensions)
  debug(extensions)

  const files = await glob(`**/*.${ext}`, {
    ignore: ['node_modules', '.git', '**/__*__/*', ...exclude],
    onlyFiles: true,
    cwd: path,
  })

  return files
}
