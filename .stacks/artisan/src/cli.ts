#!/usr/bin/env node
import { bold, cyan, dim, red } from 'kolorist'
import cac from 'cac'
import consola from 'consola'
import * as ezSpawn from '@jsdevtools/ez-spawn'
import { resolve } from 'pathe'
import { version } from '../package.json'
import { startDevelopmentServer } from './dev'
import { startBuildProcess } from './build'
import { reinstallNpmDependencies } from './fresh'
import { lint, lintFix } from './lint'
import { updateNpmDependencies } from './update'
import { component as makeComponent, fx as makeFunction, language as makeLanguage, stack as makeStack } from './make'
import { generateTestCoverageReport, runTestSuite, typecheck } from './test'
import { release } from './release'
import { commit } from './commit'
import { generateTypes } from './generate'
import { runExample } from './examples'
import { ExitCode } from './cli/exit-code'

const artisanInit = cac('artisan-init')
const artisan = cac('artisan')

// Setup global error handlers
process.on('uncaughtException', errorHandler)
process.on('unhandledRejection', errorHandler)

artisanInit
  .version(version)
  .option('-n, --name <name>', 'Name of the stack')
  .option('-u, --ui', 'Are you building a UI?', { default: true }) // if no, disregard remainder of questions wrt UI
  .option('-c, --components', 'Are you building UI components?', { default: true }) // if no, -v and -w would be false
  .option('-w, --web-components', 'Automagically built optimized custom elements/web components?', { default: true })
  .option('-v, --vue', 'Automagically built a Vue component library?', { default: true })
  .option('-p, --pages', 'How about pages?', { default: true }) // pages need an HTTP server
  .option('-f, --functions', 'Are you developing functions/composables?', { default: true }) // if no, API would be false
  .option('-a, --api', 'Are you building an API?', { default: true }) // APIs need an HTTP server & assumes functions is true
  .option('-d, --database', 'Do you need a database?', { default: true })
  // .option('--auth', 'Scaffold an authentication?', { default: true })
  .help()

artisanInit
  .command('')
  .action(async (args: any) => {
    const name = artisanInit.args[0] || args.name || '.'

    try {
      // eslint-disable-next-line no-console
      console.log()
      // eslint-disable-next-line no-console
      console.log(cyan(bold('Artisan CLI')) + dim(` v${version}`))
      // eslint-disable-next-line no-console
      console.log()

      const path = resolve(process.cwd(), name)
      await ezSpawn.async(`giget stacks ${path}`, { stdio: 'ignore' })
      consola.success('Successfully scaffolded your project.')
      // eslint-disable-next-line no-console
      console.log()
      consola.info('Getting started is easy. Run the following in your terminal:')
      // eslint-disable-next-line no-console
      console.log(`$ cd ${path} && pnpm install`)
      // eslint-disable-next-line no-console
      console.log()
      consola.info('Click here to learn more')
      // eslint-disable-next-line no-console
      console.log('https://stacks.ow3.org/wip')
    }
    catch (e: any) {
      console.error(red(String(e)))
      if (e?.stack)
        console.error(dim(e.stack?.split('\n').slice(1).join('\n')))
      process.exit(1)
    }
  })

artisanInit.parse()

artisan
  .command('dev', 'Start the development server for any of the following packages')
  .option('-c, --components', 'Start the Components development server')
  .option('-f, --functions', 'Start the Functions development server')
  .option('-d, --docs', 'Start the Documentation development server')
// .option('-p, --pages', 'Start the Pages development server')
  .action(async (options: any) => {
    await startDevelopmentServer(options)
  })

artisan
  .command('dev:components', 'Start the development server for your component library')
  .action(async () => {
    await startDevelopmentServer('components')
  })

artisan
  .command('dev:docs', 'Start the development server for your documentation')
  .action(async () => {
    await startDevelopmentServer('docs')
  })

artisan
  .command('build', 'Automagically build any of your libraries/packages for production use. Select any of the following packages')
  .option('-c, --components', 'Build your component library')
  .option('-w, --web-components', 'Build your framework agnostic web component library') // these are automatically built with your -c option as well
  .option('-e, --elements', 'An alias to the -w flag')
  .option('-f, --functions', 'Build your function library')
  .option('-d, --docs', 'Build your documentation site')
// .option('-p, --pages', 'Build your pages')
  .action(async (options: any) => {
    await startBuildProcess(options)
  })

artisan
  .command('build:components', 'Automagically build your component libraries for production use & npm/CDN distribution.')
  .action(async () => {
    await startBuildProcess('components')
  })

artisan
  .command('build:functions', 'Automagically build your function library for production use & npm/CDN distribution.')
  .action(async () => {
    await startBuildProcess('functions')
  })

artisan
  .command('build:web-components', 'Automagically build web component library for production use & npm/CDN distribution.')
  .action(async () => {
    await startBuildProcess('web-components')
  })

artisan
  .command('build:docs', 'Automagically build your documentation site.')
  .action(async () => {
    await startBuildProcess('docs')
  })

artisan
  .command('build:stacks', 'Build the core Stacks framework.')
  .action(async () => {
    await startBuildProcess('stacks')
  })

artisan
  .command('fresh', 'Reinstalls your npm dependencies.')
  .action(async () => {
    await reinstallNpmDependencies()
  })

artisan
  .command('update', 'Updates your npm dependencies to their latest version based on the specified range.')
  .action(async () => {
    await updateNpmDependencies()
  })

artisan
  .command('lint', 'Automagically lints your codebase.')
  .action(async () => {
    await lint()
  })

artisan
  .command('lint:fix', 'Automagically fixes lint errors.')
  .action(async () => {
    await lintFix()
  })

artisan
  .command('make:component', 'Scaffolds a component.')
  .action(async () => {
    await makeComponent(cli.args[0])
  })

artisan
  .command('make:function', 'Scaffolds a function.')
  .action(async () => {
    await makeFunction(cli.args[0])
  })

artisan
  .command('make:lang', 'Scaffolds a language file.')
  .action(async () => {
    await makeLanguage(cli.args[0])
  })

artisan
  .command('make:stack', 'Scaffolds a new stack.')
  .action(async () => {
    await makeStack(cli.args[0])
  })

artisan
  .command('example', 'Test your libraries against your built bundle.')
  .option('-c, --components', 'Test your Vue component library')
  .option('-v, --vue', 'Test your Vue component library')
  .option('-w, --web-components', 'Test your web component library')
  .option('-e, --elements', 'An alias to the -w flag')
  .action(async (options) => {
    await runExample(options)
  })

artisan
  .command('example:vue', 'Test your Vue component library.')
  .action(async () => {
    await runExample('vue')
  })

artisan
  .command('example:web-components', 'Test your Web Component library.')
  .action(async () => {
    await runExample('web-components')
  })

artisan
  .command('test', 'Runs your test suite.')
  .action(async () => {
    await runTestSuite()
  })

artisan
  .command('test:types', 'Typechecks your codebase.')
  .action(async () => {
    await typecheck()
  })

artisan
  .command('test:coverage', 'Generates a test coverage report.')
  .action(async () => {
    await generateTestCoverageReport()
  })

artisan
  .command('release', 'Releases a new version of your libraries/packages.')
  .action(async () => {
    await release()
  })

artisan
  .command('commit', 'Commit your stashed changes.')
  .action(async () => {
    await commit()
  })

artisan
  .command('generate:types', 'Generates the types of your library/libraries.')
  .action(async () => {
    await generateTypes()
  })

artisan
  .version(version)
  .command('version', 'Review the current version')
  .outputVersion()

artisan.parse()

function errorHandler(error: Error): void {
  let message = error.message || String(error)

  if (process.env.DEBUG || process.env.NODE_ENV === 'development')
    message = error.stack || message

  console.error(message)
  process.exit(ExitCode.FatalError)
}
