#!/usr/bin/env node

/**
 * This action generates the web-types.json & custom-elements.json
 * files for the components.
 */

import consola from 'consola'
import { generateVsCodeCustomData, hasComponents } from '../src'

async function generate() {
  if (hasComponents())
    await generateVsCodeCustomData()

  else
    consola.info('No components found. Skipping VS Code custom data generation.')
}

generate()
