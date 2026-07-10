#!/usr/bin/env bun
import { execSync, log, parseOptions } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { generateChangelog, loadLogsmithConfig } from '@stacksjs/logsmith'

type ChangelogOptions = {
  dryRun?: boolean
  quiet?: boolean
  verbose?: boolean
  from?: string
  to?: string
  version?: string
  r?: string
}

const sanitizeRevision = (revision: string): string => {
  const value = revision.trim()

  if (!/^[A-Za-z0-9._/-]+$/.test(value))
    throw new Error(`Invalid git revision: ${value}`)

  return value
}

// when log.debug is used, only log to file in production
log.debug('Generating changelog')
const options = parseOptions() as ChangelogOptions | undefined
const fromRevision = sanitizeRevision(options?.from?.toString() ?? await execSync('git describe --abbrev=0 --tags HEAD^').catch(() => ''))
log.debug('FromRevision', fromRevision)
const toRevision = sanitizeRevision(options?.to?.toString() ?? 'HEAD')
log.debug('ToRevision', toRevision)
log.debug('Changelog Options', options)

// `--version` was a changelogen concept (its `-r` release header). logsmith
// derives the section header from the `from…to` compare range instead, so the
// flag is accepted for backward compatibility but no longer needed.
if (options?.version ?? options?.r)
  log.debug('Ignoring --version: logsmith headers the section from the from…to range')

const isDryRun = options?.dryRun === true

// Generate through logsmith's SDK rather than shelling out to changelogen. The
// `github` theme matches the repo's committed changelog style; on a dry run we
// render to the console (`output: false`) instead of writing the file.
const config = await loadLogsmithConfig({
  dir: projectPath(),
  from: fromRevision || undefined,
  to: toRevision,
  output: isDryRun ? false : 'CHANGELOG.md',
  theme: 'github',
  verbose: options?.verbose === true,
})

const result = await generateChangelog(config)

if (isDryRun && !options?.quiet)
  log.info(result.content)
