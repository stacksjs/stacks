import consola from 'consola'
import Prompts from 'prompts'
import { NpmScript } from '../../../core/types'
import { ExitCode } from '../cli/exit-code'
import { lintFix } from './lint'
import { runNpmScript } from './run-npm-script'

const { prompts } = Prompts

export async function generateTypes() {
  try {
    await runNpmScript(NpmScript.GenerateTypes, 'ignore')
    consola.success('Types were generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your types.')
    consola.error(error)
  }
}

export async function generateLibEntries() {
  try {
    await runNpmScript(NpmScript.GenerateEntries, 'ignore')
    consola.success('Library entry points were generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your library entry points.')
    consola.error(error)
  }
}

export async function generateVueCompat() {
  try {
    await runNpmScript(NpmScript.GenerateVueCompat, 'ignore')
    consola.success('Vue 2 & 3 compatibility was generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating Vue compatibility.')
    consola.error(error)
  }
}

export async function generateWebTypes() {
  try {
    await runNpmScript(NpmScript.GenerateWebTypes, 'ignore')
    consola.success('Successfully generated the web-types.json file.')
  }
  catch (error) {
    consola.error('There was an error generating the web-types.json file')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function generateVsCodeCustomData() {
  try {
    await runNpmScript(NpmScript.GenerateVsCodeCustomData, 'ignore')
    await lintFix('ignore') // the created json file needs to be linted
    consola.success('Successfully generated the custom-elements.json file.')
  }
  catch (error) {
    consola.error('There was an error generating the custom-elements.json file')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function generateIdeHelpers() {
  try {
    await runNpmScript(NpmScript.GenerateIdeHelpers, 'ignore')
    await lintFix('ignore') // the created json file needs to be linted
    consola.success('Successfully generated IDE helpers.')
  }
  catch (error) {
    consola.error('There was an error generating IDE helpers.')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function startGenerationProcess(options: any) {
  if (options.types || options === 'types') {
    await generateTypes()
  }

  else if (options.entries || options === 'entries') {
    await generateLibEntries()
  }

  else if (options.webTypes || options === 'web-types') {
    await generateWebTypes()
  }

  else if (options.customData || options === 'custom-data') {
    await generateVsCodeCustomData()
  }

  else if (options.ideHelpers || options === 'ide-helpers') {
    await generateIdeHelpers()
  }

  else if (options.vueCompatibility || options === 'vue-compatibility') {
    await generateVueCompat()
  }

  else {
    const answer = await prompts.select({
      type: 'select',
      name: 'generate',
      message: 'What are you trying to generate?',
      choices: [ // todo: should be a multi-select
        { title: '1.) TypeScript Types', value: 'types' },
        { title: '2.) Library Entry Points', value: 'entries' },
        { title: '3.) Web Types', value: 'web-types' },
        { title: '4.) VS Code Custom Data', value: 'custom-data' },
        { title: '5.) IDE Helpers', value: 'ide-helpers' },
        { title: '6.) Vue 2 & 3 Compatibility', value: 'vue-compatibility' },
      ],
      initial: 0,
    })

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    if (answer === 'types')
      await generateTypes()

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    else if (answer === 'entries')
      await generateLibEntries()

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    else if (answer === 'web-types')
      await generateWebTypes()

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    else if (answer === 'custom-data')
      await generateVsCodeCustomData()

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    else if (answer === 'ide-helpers')
      await generateIdeHelpers()

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    else if (answer === 'vue-compatibility')
      await generateVueCompat()

    else process.exit(ExitCode.InvalidArgument)
  }
}
