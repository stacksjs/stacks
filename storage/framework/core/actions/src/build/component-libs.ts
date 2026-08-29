#!/usr/bin/env bun
import { log } from '@stacksjs/logging'
import { buildLibraryPackages } from '../library/build'

const reports = await buildLibraryPackages({ kinds: ['components'] })

log.success(`Built ${reports.length} component package${reports.length === 1 ? '' : 's'}.`)
