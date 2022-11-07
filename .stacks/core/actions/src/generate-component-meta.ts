#!/usr/bin/env node

/**
 * This action generates the component meta.
 */

import { log } from '@stacksjs/logging'
import { hasComponents } from '@stacksjs/storage'
import { generateComponentMeta } from './helpers/component-meta'

if (hasComponents())
  await generateComponentMeta()

else
  log.info('No components found. Skipping component meta generation.')
