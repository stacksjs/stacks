import process from 'node:process'
import { log } from 'src/logging/src'
import { runNpmScript } from 'src/utils/src'
import type { TypesOptions } from 'src/types/src'
import { NpmScript } from 'src/enums/src'

export async function invoke(options?: TypesOptions) {
  const results = await runNpmScript(NpmScript.TypesFix, options)

  if (results.isErr()) {
    log.error('There was an error fixing your types.', results.error)
    process.exit()
  }

  log.success('Types are set')
}

export async function types(options: TypesOptions) {
  return invoke(options)
}
