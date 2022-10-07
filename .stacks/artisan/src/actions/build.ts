import { resolve } from 'pathe'
import Prompts from 'prompts'
import consola from 'consola'
import { hasFiles } from '../../../core/utils/fs'
import { NpmScript } from '../../../core/types'
import { ExitCode } from '../cli/exit-code'
import { runNpmScript } from './run-npm-script'
import { generateTypes } from './generate'

const { prompts } = Prompts

export async function buildComponentLibraries() {
  try {
    await runNpmScript(NpmScript.GenerateEntries)
    await buildVueComponentLibrary()
    await buildWebComponentLibrary()
  }
  catch (error) {
    consola.error('There was an error building your component libraries.')
    consola.error(error)
  }
}

export async function buildVueComponentLibrary() {
  consola.info('Building your component library...')

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
      await runNpmScript(NpmScript.BuildWebComponents)
      consola.success('Your Web Component library was built successfully.')
    }
    catch (error) {
      consola.error('There was an error building your Web Component library.')
      consola.error(error)
    }
  }
  else {
    consola.info('No components found.')
  }
}

export async function buildDocs() {
  consola.info('Building the Artisan CLI...')

  try {
    await runNpmScript(NpmScript.BuildDocs)
    consola.success('Artisan CLI was built successfully.')
  }
  catch (error) {
    consola.error('There was an error building the Artisan CLI.')
    consola.error(error)
  }
}

export async function buildStacks() {
  consola.info('Building the Stacks Framework...')

  try {
    await runNpmScript(NpmScript.BuildStacks)
    consola.success('Stacks was built successfully.')
  }
  catch (error) {
    consola.error('There was an error building the Stacks framework.')
    consola.error(error)
  }
}

export async function buildFunctionsLibrary() {
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

export async function startBuildProcess(options: any) {
  if (options.components || options === 'components') {
    await buildComponentLibraries()
  }

  else if (options.webComponents || options.elements || options === 'web-components' || options === 'elements') {
    await buildWebComponentLibrary()
  }

  else if (options.functions || options === 'functions') {
    await buildFunctionsLibrary()
  }

  else if (options.docs || options === 'docs') {
    await buildDocs()
  }

  else if (options.stacks || options === 'stacks') {
    await buildStacks()
  }

  else if (options.npm || options === 'npm') {
    await buildComponentLibraries()
    await buildFunctionsLibrary()

    consola.success('All your libraries and its types were built successfully to be distributed on npm.')
  }

  else {
    const answer = await prompts.select({
      type: 'select',
      name: 'build',
      message: 'Which stack are you trying to build for production use?',
      choices: [ // todo: should be a multi-select
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
      await buildFunctionsLibrary()

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    else if (answer === 'docs')
      await buildDocs()

    else process.exit(ExitCode.InvalidArgument)
  }

  await generateTypes()
}
