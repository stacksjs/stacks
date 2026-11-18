import { join } from 'node:path'
import { projectPath } from '@stacksjs/path'
import { environmentBackupPath, readEnvironmentFile, updateEnvironmentFile } from './environment-file'
import type { EnvironmentFileIssue, EnvironmentFileState } from './environment-file'
import { editableEnvironmentFiles, keysReadElsewhere, readEnvironmentLayers } from './environment-layers'
import type { EnvironmentLayersOptions, KeyReadElsewhere } from './environment-layers'

/**
 * What the Environment page shows: one env file, every env file the app
 * loads, and the keys in this one whose value the app takes from a later
 * file (stacksjs/stacks#3341).
 *
 * The page edited `.env` alone. A key set again in `.env.<env>` kept that
 * file's value, so an edit to it in `.env` was saved and changed nothing the
 * app read, and the file that did set it could not be opened.
 */
export interface EnvironmentPage {
  environment: EnvironmentFileState
  /** The files the page can open, in the order the app loads them. */
  files: string[]
  readElsewhere: KeyReadElsewhere[]
}

/** The file a request names, if it is one of the env files the app loads; `.env` when it names none. */
function editableFile(requested: unknown, files: string[]): string | null {
  const file = requested === undefined || requested === null || requested === '' ? '.env' : requested
  return typeof file === 'string' && files.includes(file) ? file : null
}

function fileOptions(file: string, options: EnvironmentLayersOptions) {
  return {
    name: file,
    envPath: join(options.cwd ?? projectPath(), file),
    backupPath: (options.backupPathFor ?? environmentBackupPath)(file),
  }
}

/** The page for one env file, or null when the request names a file the app does not load. */
export async function readEnvironmentPage(requested: unknown, options: EnvironmentLayersOptions = {}): Promise<EnvironmentPage | null> {
  const layers = await readEnvironmentLayers(options)
  const files = editableEnvironmentFiles(layers)
  const file = editableFile(requested, files)
  if (!file)
    return null

  return {
    environment: await readEnvironmentFile(fileOptions(file, options)),
    files,
    readElsewhere: keysReadElsewhere(layers, file),
  }
}

/** Replace one env file's content, as `updateEnvironmentFile` does, and return its page. */
export async function saveEnvironmentPage(
  requested: unknown,
  content: string,
  revision: string,
  options: EnvironmentLayersOptions = {},
): Promise<{ page?: EnvironmentPage, issues?: EnvironmentFileIssue[], conflict?: boolean, unknownFile?: true }> {
  const file = editableFile(requested, editableEnvironmentFiles(await readEnvironmentLayers(options)))
  if (!file)
    return { unknownFile: true }

  const result = await updateEnvironmentFile(content, revision, fileOptions(file, options))
  if (result.issues || result.conflict)
    return result

  return { page: (await readEnvironmentPage(file, options))! }
}
