#!/usr/bin/env bun
import { log } from 'src/logging/src'
import { hasComponents, hasFunctions } from 'src/storage/src'
import { generateLibEntry } from '../helpers/lib-entries'

if (hasComponents()) {
  await generateLibEntry('vue-components')
  await generateLibEntry('web-components')
}
else {
  log.info('No components found. Skipping building component entry points.')
}

if (hasFunctions())
  await generateLibEntry('functions')
else
  log.info('No functions found. Skipping building function entry point.')
