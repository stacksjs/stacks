#!/usr/bin/env bun
import { log } from '@stacksjs/logging'
import { buildLibraryPackages } from '../library/build'

const reports = await buildLibraryPackages()

log.success(`Built ${reports.length} librar${reports.length === 1 ? 'y' : 'ies'}: ${reports.map(report => report.name).join(', ')}`)
