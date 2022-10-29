import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { type GeneratorOptions, NpmScript } from '@stacksjs/types'

export async function fixTypes(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.TypesFix, options)
    consola.success('Types were fixed.')
  }
  catch (error) {
    consola.error('There was an error fixing your types.')
    consola.error(error)
  }
}
