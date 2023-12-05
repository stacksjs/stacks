#!/usr/bin/env bun

/**
 * This action generates the web-types.json & custom-elements.json
 * files for the components.
 */

import { log } from 'stacks:logging'
import { hasComponents } from 'stacks:storage'
import { generateVsCodeCustomData } from '../helpers/vscode-custom-data'

if (hasComponents())
  await generateVsCodeCustomData()

else
  log.info('No components found. Skipping VS Code custom data generation.')
