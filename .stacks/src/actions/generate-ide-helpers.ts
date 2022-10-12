#!/usr/bin/env node

/**
 * This action generates the web-types.json & custom-elements.json
 * files for the components.
 */

import consola from 'consola'
import { generateVsCodeCustomData, generateWebTypes } from '../../artisan/src/actions/generate'
import { hasComponents } from '..'

async function generate() {
  if (hasComponents()) {
    await generateWebTypes()
    await generateVsCodeCustomData()
  }
  else {
    consola.info('No components found. Skipping IDE helper generation.')
  }
}

generate()
