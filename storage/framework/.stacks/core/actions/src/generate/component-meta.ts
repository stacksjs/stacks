#!/usr/bin/env bun

/**
 * This action generates the component meta.
 */

import { log } from 'stacks:logging'
import { hasComponents } from 'stacks:storage'
import { generateComponentMeta } from '../helpers/component-meta'

if (hasComponents())
  generateComponentMeta()

else
  log.info('No components found. Skipping component meta generation.')
