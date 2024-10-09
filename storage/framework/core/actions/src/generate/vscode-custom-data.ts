#!/usr/bin/env bun

/**
 * This action generates the web-types.json & custom-elements.json
 * files for the components.
 */

import { log } from '@stacksjs/logging'
import { hasComponents } from '@stacksjs/storage'
import { generateVsCodeCustomData } from '../helpers/vscode-custom-data'

log.info('Generating VS Code custom data...')

if (hasComponents())
  await generateVsCodeCustomData()
else log.info('No components found. Skipping VS Code custom data generation.')

log.success('Generated VS Code custom data.')
