import Prompts from 'prompts'
import consola from 'consola'
import { runNpmScript } from 'utils'
import { ExitCode, NpmScript } from 'types'

const { prompts } = Prompts

export async function startDevelopmentServer(options: any) {
  if (options.components || options === 'components') {
    consola.info('Starting development server for your components...')
    await runNpmScript(NpmScript.DevComponents)
  }

  else if (options.docs || options === 'docs') {
    consola.info('Starting development server for your documentation...')
    await runNpmScript(NpmScript.DevDocs)
  }

  else {
    const answer = await prompts.select({
      type: 'select',
      name: 'development',
      message: 'Which development server are you trying to start?',
      choices: [
        { title: 'Components', value: 'components' },
        // { title: 'Functions', value: 'functions' },
        // { title: 'Pages', value: 'pages' },
        { title: 'Docs', value: 'docs' },
      ],
      initial: 0,
    })

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    if (answer === 'components') {
      consola.info('Starting development server for your components...')
      await runNpmScript(NpmScript.DevComponents)
    }

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    else if (answer === 'docs') {
      consola.info('Starting docs server for your components...')
      await runNpmScript(NpmScript.DevDocs)
    }

    else { process.exit(ExitCode.InvalidArgument) }
  }
}
