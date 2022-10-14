import type { CAC } from 'cac'
import { component as makeComponent, fx as makeFunction, language as makeLanguage, stack as makeStack } from '../actions/make'

async function make(artisan: CAC) {
  artisan
    .command('make:component', 'Scaffolds a component.')
    .action(async () => {
      await makeComponent(artisan.args[0])
    })

  artisan
    .command('make:function', 'Scaffolds a function.')
    .action(async () => {
      await makeFunction(artisan.args[0])
    })

  artisan
    .command('make:lang', 'Scaffolds a language file.')
    .action(async () => {
      await makeLanguage(artisan.args[0])
    })

  artisan
    .command('make:stack', 'Scaffolds a new stack.')
    .action(async () => {
      await makeStack(artisan.args[0])
    })
}

export { make }
