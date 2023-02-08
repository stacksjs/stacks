#!/usr/bin/env node

/**
 * This action generates the web-types.json & custom-elements.json
 * files for the components.
 */

import { log } from '@stacksjs/logging'
import { hasComponents } from '@stacksjs/storage'
import { generateVsCodeCustomData } from '../helpers/vscode-custom-data'

if (hasComponents())
  await generateVsCodeCustomData()

else
  log.info('No components found. Skipping VS Code custom data generation.')
