import process from 'node:process'
import { log } from '@stacksjs/logging'
import { runNpmScript } from '@stacksjs/utils'
import { NpmScript, type TypesOptions } from '@stacksjs/types'

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
