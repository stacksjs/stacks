import type { CAC } from 'cac'
import { component as makeComponent, fx as makeFunction, language as makeLanguage, page as makePage, stack as makeStack } from './actions/make'

async function make(stacks: CAC) {
  stacks
    .command('make', 'Test your libraries against your built bundle.')
    .option('-c, --component', 'Scaffolds a component.')
    .option('-p, --page', 'Scaffolds a page.')
    .option('-f, --function', 'Scaffolds a function.')
    .option('-l, --language', 'Scaffolds a language.')
    .option('-s, --stack', 'Scaffolds a new stack.')
    .action(async (options) => {
      await runMake(stacks.args[0], options)
    })

  stacks
    .command('make:component', 'Scaffolds a component.')
    .action(async () => {
      await makeComponent(stacks.args[0])
    })

  stacks
    .command('make:page', 'Scaffolds a page.')
    .action(async () => {
      await makePage(stacks.args[0])
    })

  stacks
    .command('make:function', 'Scaffolds a function.')
    .action(async () => {
      await makeFunction(stacks.args[0])
    })

  stacks
    .command('make:lang', 'Scaffolds a language file.')
    .action(async () => {
      await makeLanguage(stacks.args[0])
    })

  stacks
    .command('make:stack', 'Scaffolds a new stack.')
    .action(async () => {
      await makeStack(stacks.args[0])
    })
}

export { make }
