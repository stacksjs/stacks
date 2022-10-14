#!/usr/bin/env node
import consola from 'consola'
import { hasComponents, hasFunctions } from '@stacksjs/utils'
import { generateLibEntry } from './generate/lib-entries'

async function generate() {
  if (hasComponents()) {
    await generateLibEntry('vue-components')
    await generateLibEntry('web-components')
  }
  else {
    consola.info('No components found. Skipping building component entry points.')
  }

  if (hasFunctions())
    await generateLibEntry('functions')

  else
    consola.info('No functions found. Skipping building function entry point.')
}

generate()
