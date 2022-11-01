#!/usr/bin/env node

/**
 * This action generates the web-types.json & custom-elements.json
 * files for the components.
 */

import consola from 'consola'
import { hasComponents } from '@stacksjs/storage'
import { generateVsCodeCustomData } from './helpers/vscode-custom-data'
// import { generateVsCodeCustomData, generateWebTypes } from './generate/vscode-custom-data'

async function invoke() {
  if (hasComponents()) {
    // await generateWebTypes()
    await generateVsCodeCustomData()
  }
  else {
    consola.info('No components found. Skipping IDE helper generation.')
  }
}

invoke()
