import Prompts from 'prompts'
import consola from 'consola'
import { ExitCode } from '../cli/exit-code'
import { NpmScript } from '../types/cli'
import { runNpmScript } from './run-npm-script'

const { prompts } = Prompts

export async function startBuildProcess(options: any) {
  if (options.components || options === 'components') {
    consola.info('Building your component library for production use & npm/CDN distribution...')
    await runNpmScript(NpmScript.BuildComponents)
    consola.success('Your component library was built successfully.')

    consola.info('Building your web component library for production use & npm/CDN distribution...')
    await runNpmScript(NpmScript.BuildElements)
    consola.success('Your web components library was built successfully.')
  }

  else if (options.webComponents || options.elements || options === 'web-components' || options === 'elements') {
    consola.info('Building your web component library for production use & npm/CDN distribution...')
    await runNpmScript(NpmScript.BuildElements)
    consola.success('Your web components library was built successfully.')
  }

  else if (options.functions || options === 'functions') {
    consola.info('Building your functions library for production use & npm/CDN distribution...')
    await runNpmScript(NpmScript.BuildFunctions)
    consola.success('Your functions library was built successfully.')
  }

  else if (options.artisanCli || options === 'artisan-cli') {
    consola.info('Building the Artisan CLI...')
    await runNpmScript(NpmScript.BuildArtisanCli)
    consola.success('Artisan CLI was built successfully.')
  }

  else if (options.docs || options === 'docs') {
    consola.info('Building the Documentation...')
    await runNpmScript(NpmScript.BuildDocs)
    consola.success('Documentation was built successfully.')
  }

  else {
    const answer = await prompts.select({
      type: 'select',
      name: 'build',
      message: 'Which stack are you trying to build for production use?',
      choices: [
        { title: 'Components', value: 'components' },
        { title: 'Functions', value: 'functions' },
        // { title: 'Pages', value: 'pages' },
        { title: 'Docs', value: 'docs' },
      ],
      initial: 0,
    })

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    if (answer === 'components') {
      consola.info('Building your Stacks component library for production use...')
      await runNpmScript(NpmScript.BuildComponents)
    }

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    else if (answer === 'functions') {
      consola.info('Building your Stacks function library for production use...')
      await runNpmScript(NpmScript.DevFunctions)
    }

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    else if (answer === 'docs') {
      consola.info('Building your documentation site to be deployed...')
      await runNpmScript(NpmScript.BuildDocs)
    }

    else { process.exit(ExitCode.InvalidArgument) }
  }
}
