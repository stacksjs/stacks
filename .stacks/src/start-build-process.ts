import Prompts from 'prompts'
import { ExitCode } from './cli/exit-code'
import { runNpmScript } from './run-npm-script'
import { NpmScript } from './types/cli'

const { prompts } = Prompts

export async function startBuildProcess(options) {
  if (options.components || options === 'components') {
    // eslint-disable-next-line no-console
    console.log('Building your component library for production use...')
    await runNpmScript(NpmScript.BuildComponents)
  }

  // else if (options.functions) {
  //   // eslint-disable-next-line no-console
  //   console.log('Building your function library for production use...')
  //   await runNpmScript(NpmScript.BuildFunctions)
  // }

  // else if (options.pages) {
  //   // eslint-disable-next-line no-console
  //   console.log('Building your pages for production use...')
  //   await runNpmScript(NpmScript.BuildPages)
  // }

  // else if (options.docs) {
  //   // eslint-disable-next-line no-console
  //   console.log('Starting development server for components...')
  //   await runNpmScript(NpmScript.BuildDocs)
  // }

  else {
    const answer = await prompts.select({
      message: 'Which development server are you trying to start?',
      choices: ['Components', 'Functions', 'Pages', 'Docs'],
      initial: 0,
    })

    if (answer === 0) {
      // eslint-disable-next-line no-console
      console.log('Building your component library for production use...')
      await runNpmScript(NpmScript.BuildComponents)
    }

    // else if (answer === 1) {
    //   // eslint-disable-next-line no-console
    //   console.log('Building your function library for production use...')
    //   await runNpmScript(NpmScript.DevFunctions)
    // }

    // else if (answer === 2) {
    //   // eslint-disable-next-line no-console
    //   console.log('Building your pages for production use...')
    //   await runNpmScript(NpmScript.DevPages)
    // }

    // else if (answer === 3) {
    //   // eslint-disable-next-line no-console
    //   console.log('Building your documentation for production use...')
    //   await runNpmScript(NpmScript.DevDocs)
    // }

    else { process.exit(ExitCode.InvalidArgument) }
  }
}
