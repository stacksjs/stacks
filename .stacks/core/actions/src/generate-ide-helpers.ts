#!/usr/bin/env node

/**
 * This action generates the web-types.json & custom-elements.json
 * files for the components.
 */

import { log } from '@stacksjs/logging'
import { hasComponents } from '@stacksjs/storage'
import { generateVsCodeCustomData } from './helpers/vscode-custom-data'
// import { generateVsCodeCustomData, generateWebTypes } from './generate/vscode-custom-data'

if (hasComponents()) {
  // await generateWebTypes()
  await generateVsCodeCustomData()
}
else {
  log.info('No components found. Skipping IDE helper generation.')
}
