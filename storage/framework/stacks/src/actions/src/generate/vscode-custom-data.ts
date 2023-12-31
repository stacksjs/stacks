#!/usr/bin/env bun

/**
 * This action generates the web-types.json & custom-elements.json
 * files for the components.
 */

import { log } from 'src/logging/src'
import { hasComponents } from 'src/storage/src'
import { generateVsCodeCustomData } from '../helpers/vscode-custom-data'

if (hasComponents())
  await generateVsCodeCustomData()

else
  log.info('No components found. Skipping VS Code custom data generation.')
