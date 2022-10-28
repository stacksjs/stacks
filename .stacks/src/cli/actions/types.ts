import { consola } from '@stacksjs/cli'
import { debugLevel } from '@stacksjs/config'
import { runNpmScript } from '@stacksjs/utils'
import { type GeneratorOptions, NpmScript } from '@stacksjs/types'

export async function generateTypes(options?: GeneratorOptions) {
  try {
    const debug = debugLevel(options)

    await runNpmScript(NpmScript.TypesGenerate, { debug })
    consola.success('Types were generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your types.')
    consola.error(error)
  }
}

export async function fixTypes(options?: GeneratorOptions) {
  try {
    const debug = debugLevel(options)

    await runNpmScript(NpmScript.TypesFix, { debug })
    consola.success('Types were generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your types.')
    consola.error(error)
  }
}
