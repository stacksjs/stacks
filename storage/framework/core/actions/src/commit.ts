import type { CleanOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { runNpmScript } from '@stacksjs/utils'

export async function invoke(options: CleanOptions): Promise<void> {
  log.info('Committing...')
  await runNpmScript(NpmScript.Commit, { cwd: projectPath(), ...options })
  log.success('Committed')
}

export async function commit(options: CleanOptions): Promise<void> {
  return await invoke(options)
}
