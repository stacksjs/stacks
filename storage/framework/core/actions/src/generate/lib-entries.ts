#!/usr/bin/env bun
import { library } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { generateLibraryPackages } from '../library/build'

export async function generateLibEntries(): Promise<void> {
  // `releaseable: false` means this project builds no publishable library.
  // Defaulting to true keeps an app whose config predates the flag working.
  if (library?.releaseable === false) {
    log.info('library.releaseable is false. Skipping library entry points.')
    return
  }

  log.info('Generating library entry points...')

  // `allowEmpty` because most apps ship no library at all, and a release must
  // not be blocked by a `packages` list that is empty or points at a
  // `resources/` directory this app never filled in.
  const reports = await generateLibraryPackages({ allowEmpty: true })

  for (const report of reports)
    log.success(`Generated ${report.name} (${report.kind}, ${report.sources} sources)`)
}

await generateLibEntries()
