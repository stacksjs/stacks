#!/usr/bin/env bun
import { library } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { hasComponents, hasFunctions } from '@stacksjs/storage'
import { generateLibEntry } from '../helpers/lib-entries'

export async function generateLibEntries() {
  console.log('generateLibEntries')
  log.info('Generating library entry points...')
  console.log('generateLibEntries2')

  if (library.releaseable && hasComponents()) {
    await generateLibEntry('vue-components')
    await generateLibEntry('web-components')
  } else {
    log.info('No components found. Skipping building component entry points.')
  }

  if (library.releaseable && hasFunctions()) await generateLibEntry('functions')
  else log.info('No functions found. Skipping building function entry point.')
}

await generateLibEntries()
