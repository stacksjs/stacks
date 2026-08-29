#!/usr/bin/env bun
import { log } from '@stacksjs/logging'
import { buildLibraryPackages } from './library/build'

const reports = await buildLibraryPackages({ kinds: ['web-components'] })

log.success(`Built ${reports.length} web component package${reports.length === 1 ? '' : 's'}.`)
