#!/usr/bin/env node

/**
 * This action generates the component meta.
 */

import consola from 'consola'
import { hasComponents } from '@stacksjs/storage'
import { generateComponentMeta } from './helpers/component-meta'

if (hasComponents())
  await generateComponentMeta()

else
  consola.info('No components found. Skipping component meta generation.')
