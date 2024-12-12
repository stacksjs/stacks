#!/usr/bin/env bun

/**
 * This action generates the component meta.
 */

import { log } from '@stacksjs/logging'
import { hasComponents } from '@stacksjs/storage'
import { generateComponentMeta } from '../helpers/component-meta'

log.info('Generating component meta...')

if (hasComponents())
  generateComponentMeta()
else log.info('No components found. Skipping component meta generation.')

log.success('Generated component meta.')
