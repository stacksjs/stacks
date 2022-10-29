#!/usr/bin/env node
import consola from 'consola'
import { hasComponents, hasFunctions } from '@stacksjs/storage'
import { type ActionsOptions } from '@stacksjs/types'
import { invoke as generateLibEntry } from './generate/lib-entries'

export async function invoke(options: ActionsOptions) {
  if (hasComponents()) {
    await generateLibEntry('vue-components', options)
    await generateLibEntry('web-components', options)
  }
  else {
    consola.info('No components found. Skipping building component entry points.')
  }

  if (hasFunctions())
    await generateLibEntry('functions', options)

  else
    consola.info('No functions found. Skipping building function entry point.')
}
