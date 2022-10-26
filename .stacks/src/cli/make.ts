import type { CLI } from '@stacksjs/types'
import { component as makeComponent, fx as makeFunction, language as makeLanguage, page as makePage, stack as makeStack } from './actions/make'
// import { component as makeComponent, fx as makeFunction, language as makeLanguage, notification as makeNotification, page as makePage, stack as makeStack } from './actions/make'

async function make(stacks: CLI) {
  stacks
    .command('make', 'The make command.')
    .option('-c, --component', 'Scaffold a component.')
    .option('-p, --page', 'Scaffold a page.')
    .option('-f, --function', 'Scaffold a function.')
    .option('-l, --language', 'Scaffold a language.')
    .option('-n, --notification', 'Scaffold a notification.')
    .option('-s, --stack', 'Scaffold a new stack.')
    .action(async (options) => {
      await runMake(stacks.args[0], options)
    })

  stacks
    .command('make:component', 'Scaffold a component.')
    .action(async () => {
      await makeComponent(stacks.args[0])
    })

  stacks
    .command('make:database', 'Create a new database.')
    .action(async () => {
      // await makeDatabase(stacks.args[0])
    })

  stacks
    .command('make:page', 'Scaffold a page.')
    .action(async () => {
      await makePage(stacks.args[0])
    })

  stacks
    .command('make:function', 'Scaffold a function.')
    .action(async () => {
      await makeFunction(stacks.args[0])
    })

  stacks
    .command('make:lang', 'Scaffold a language file.')
    .action(async () => {
      await makeLanguage(stacks.args[0])
    })

  stacks
    .command('make:notification', 'Scaffold a language notification.')
    .action(async () => {
      // await makeNotification(stacks.args[0])
    })

  stacks
    .command('make:stack', 'Scaffold a new stack.')
    .action(async () => {
      await makeStack(stacks.args[0])
    })
}

export { make }
