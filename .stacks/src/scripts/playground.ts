import Prompts from 'prompts'
import consola from 'consola'
import { ExitCode } from '../cli/exit-code'
import { NpmScript } from '../types/cli'
import { runNpmScript } from './run-npm-script'

const { prompts } = Prompts

// currently, can be viewed as an alias of the dev command
export async function startPlayground(options: any) {
  if (options.components || options === 'components') {
    consola.info('Starting your components playground...')
    // await runNpmScript(NpmScript.Playground)
  }

  else {
    const answer = await prompts.select({
      type: 'select',
      name: 'playground',
      message: 'Which playground are you trying to start?',
      choices: [
        { title: 'Components', value: 'components' },
      ],
      initial: 0,
    })

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    if (answer === 'components') {
      consola.info('Starting development server for your components...')
      await runNpmScript(NpmScript.DevComponents)
    }

    else { process.exit(ExitCode.InvalidArgument) }
  }
}
