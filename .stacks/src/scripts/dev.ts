import Prompts from 'prompts'
import { ExitCode } from '../cli/exit-code'
import { NpmScript } from '../types/cli'
import { runNpmScript } from './run-npm-script'

const { prompts } = Prompts

export async function startDevelopmentServer(options: any) {
  if (options.components || options === 'components') {
    // eslint-disable-next-line no-console
    console.log('Starting development server for your components...')
    await runNpmScript(NpmScript.DevComponents)
  }

  // else if (options.functions) {
  //   // eslint-disable-next-line no-console
  //   console.log('Starting development server for your functions...')
  //   await runNpmScript(NpmScript.DevFunctions)
  // }

  // else if (options.pages) {
  //   // eslint-disable-next-line no-console
  //   console.log('Starting development server for your pages...')
  //   await runNpmScript(NpmScript.DevPages)
  // }

  // else if (options.docs) {
  //   // eslint-disable-next-line no-console
  //   console.log('Starting development server for your documentation...')
  //   await runNpmScript(NpmScript.DevDocs)
  // }

  else {
    const answer = await prompts.select({
      type: 'select',
      name: 'development',
      message: 'Which development server are you trying to start?',
      choices: [
        { title: 'Components', value: 'components' },
        { title: 'Functions', value: 'functions' },
        { title: 'Pages', value: 'pages' },
        { title: 'Docs', value: 'docs' },
      ],
      initial: 0,
    })

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    if (answer === 'components') {
      // eslint-disable-next-line no-console
      console.log('Starting development server for your components...')
      await runNpmScript(NpmScript.DevComponents)
    }

    // else if (answer === 1) {
    //   // eslint-disable-next-line no-console
    //   console.log('Starting development server for your functions...')
    //   await runNpmScript(NpmScript.DevFunctions)
    // }

    // else if (answer === 2) {
    //   // eslint-disable-next-line no-console
    //   console.log('Starting development server for your pages...')
    //   await runNpmScript(NpmScript.DevPages)
    // }

    // else if (answer === 3) {
    //   // eslint-disable-next-line no-console
    //   console.log('Starting development server for your documentation...')
    //   await runNpmScript(NpmScript.DevDocs)
    // }

    else { process.exit(ExitCode.InvalidArgument) }
  }
}
