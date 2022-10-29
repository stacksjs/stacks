import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { type GeneratorOptions, NpmScript } from '@stacksjs/types'

export async function generateTypes(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.TypesGenerate, options)
    consola.success('Types were generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your types.')
    consola.error(error)
  }
}

export async function fixTypes(options?: GeneratorOptions) {
  try {
    await runNpmScript(NpmScript.TypesFix, options)
    consola.success('Types were generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your types.')
    consola.error(error)
  }
}
