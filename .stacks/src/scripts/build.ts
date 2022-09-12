import { resolve } from 'pathe'
import Prompts from 'prompts'
import consola from 'consola'
import { ExitCode } from '../cli/exit-code'
import { NpmScript } from '../types/cli'
import { hasFiles } from '../core/fs'
import { runNpmScript } from './run-npm-script'

const { prompts } = Prompts

export async function buildComponentLibraries() {
  await buildVueComponentLibrary()
  await buildWebComponentLibrary()
}

export async function buildVueComponentLibrary() {
  consola.info('Building your component library for production use & npm/CDN distribution...')

  if (hasFiles(resolve(process.cwd(), './components'))) {
    try {
      await runNpmScript(NpmScript.BuildComponents)
      consola.success('Your component library was built successfully.')
    }
    catch (error) {
      consola.error('There was an error building your component library.')
      consola.error(error)
    }
  }
  else {
    consola.info('No components found.')
  }
}

export async function buildWebComponentLibrary() {
  consola.info('Building your component library for production use & npm/CDN distribution...')

  if (hasFiles(resolve(process.cwd(), './components'))) {
    try {
      await runNpmScript(NpmScript.BuildElements)
      consola.success('Your web component library was built successfully.')
    }
    catch (error) {
      consola.error('There was an error building your web component library.')
      consola.error(error)
    }
  }
  else {
    consola.info('No components found.')
  }
}

export async function buildArtisanCli() {
  consola.info('Building the Artisan CLI...')

  try {
    await runNpmScript(NpmScript.BuildArtisanCli)
    consola.success('Artisan CLI was built successfully.')
  }
  catch (error) {
    consola.error('There was an error building the Artisan CLI.')
    consola.error(error)
  }
}

export async function buildDocs() {
  consola.info('Building the Artisan CLI...')

  try {
    await runNpmScript(NpmScript.BuildArtisanCli)
    consola.success('Artisan CLI was built successfully.')
  }
  catch (error) {
    consola.error('There was an error building the Artisan CLI.')
    consola.error(error)
  }
}

export async function buildFunctionLibrary() {
  consola.info('Building your functions library for production use & npm/CDN distribution...')

  if (hasFiles(resolve(process.cwd(), './functions'))) {
    try {
      await runNpmScript(NpmScript.BuildFunctions)
      consola.success('Your functions library was built successfully.')
    }
    catch (error) {
      consola.error('There was an error building your functions library.')
      consola.error(error)
    }
  }
  else {
    consola.info('No functions found.')
  }
}

export async function generateTypes() {
  consola.info('Building your functions library for production use & npm/CDN distribution...')

  try {
    await runNpmScript(NpmScript.GenerateTypes)
    consola.success('Your library types were generated.')
  }
  catch (error) {
    consola.error('There was an error generating your types')
    consola.error(error)
  }
}

export async function startBuildProcess(options: any) {
  if (options.components || options === 'components') {
    await buildComponentLibraries()
  }

  else if (options.webComponents || options.elements || options === 'web-components' || options === 'elements') {
    await buildWebComponentLibrary()
  }

  else if (options.functions || options === 'functions') {
    await buildFunctionLibrary()
  }

  else if (options.artisanCli || options === 'artisan-cli') {
    await buildArtisanCli()
  }

  else if (options.docs || options === 'docs') {
    await buildDocs()
  }

  else if (options.npm || options === 'npm') {
    await buildComponentLibraries()
    await buildFunctionLibrary()
    await generateTypes()

    consola.success('All your libraries and its types were built successfully to be distributed on npm.')
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
    if (answer === 'components')
      await buildComponentLibraries()

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    if (answer === 'functions')
      await buildFunctionLibrary()

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    else if (answer === 'docs')
      await buildDocs()

    else process.exit(ExitCode.InvalidArgument)
  }
}
