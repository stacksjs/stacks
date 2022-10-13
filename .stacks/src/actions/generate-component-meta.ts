#!/usr/bin/env node

/**
 * This action generates the component meta.
 */

import consola from 'consola'
import { hasComponents } from '..'
import { generateComponentMeta } from '../generate/component-meta'

async function generate() {
  if (hasComponents())
    await generateComponentMeta()

  else
    consola.info('No components found. Skipping component meta generation.')
}

generate()
