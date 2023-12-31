#!/usr/bin/env bun

/**
 * This action generates the component meta.
 */

import { log } from 'src/logging/src'
import { hasComponents } from 'src/storage/src'
import { generateComponentMeta } from '../helpers/component-meta'

if (hasComponents())
  generateComponentMeta()

else
  log.info('No components found. Skipping component meta generation.')
