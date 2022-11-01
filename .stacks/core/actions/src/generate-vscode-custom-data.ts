#!/usr/bin/env node

/**
 * This action generates the web-types.json & custom-elements.json
 * files for the components.
 */

import consola from 'consola'
import { hasComponents } from '@stacksjs/storage'
import { generateVsCodeCustomData } from './helpers/vscode-custom-data'

if (hasComponents())
  await generateVsCodeCustomData()

else
  consola.info('No components found. Skipping VS Code custom data generation.')
