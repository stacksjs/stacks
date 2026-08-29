#!/usr/bin/env bun
import { parseOptions } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { publishLibraryPackages } from './library/publish'

const options = parseOptions() as { dryRun?: boolean } | undefined
const dryRun = options?.dryRun === true || String(options?.dryRun) === 'true'

const plans = await publishLibraryPackages({ dryRun })

log.success(
  dryRun
    ? `Dry run complete. ${plans.length} package(s) would publish: ${plans.map(plan => `${plan.name}@${plan.version}`).join(', ')}`
    : `Published ${plans.map(plan => `${plan.name}@${plan.version}`).join(', ')}`,
)
