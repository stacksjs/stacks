import type { TypesOptions } from '@stacksjs/types'
import process from 'node:process'
import { NpmScript } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'
import { runNpmScript } from '@stacksjs/utils'

export async function invoke(options?: TypesOptions): Promise<void> {
  const results = await runNpmScript(NpmScript.TypesFix, options)

  if (results.isErr) {
    log.error('There was an error fixing your types.', results.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Types are set')
}

export async function types(options: TypesOptions): Promise<void> {
  return await invoke(options)
}
