#!/usr/bin/env bun
import { log } from '@stacksjs/logging'
import { buildLibraryPackages } from './library/build'

// This action file did not exist. `buddy build:functions` resolved
// `Action.BuildFunctionLib` to nothing, `build.ts` discarded the Result, and
// the command exited 0 having built nothing at all.
const reports = await buildLibraryPackages({ kinds: ['functions'] })

log.success(`Built ${reports.length} function package${reports.length === 1 ? '' : 's'}.`)
