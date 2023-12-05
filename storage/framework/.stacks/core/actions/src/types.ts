import process from 'node:process'
import { log } from 'stacks:logging'
import { runNpmScript } from 'stacks:utils'
import type { TypesOptions } from 'stacks:types'
import { NpmScript } from 'stacks:enums'

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
