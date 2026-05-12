import { execSync, log, parseOptions, runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

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

const sanitizeVersion = (version: string): string => {
  const value = version.trim().replace(/^v/, '')

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value))
    throw new Error(`Invalid changelog version: ${value}`)

  return value
}

// when log.debug is used, only log to file in production
log.debug('Generating changelog')
const options = parseOptions() as ChangelogOptions | undefined
const fromRevision = sanitizeRevision(options?.from?.toString() ?? await execSync('git describe --abbrev=0 --tags HEAD^'))
log.debug('FromRevision', fromRevision)
const toRevision = sanitizeRevision(options?.to?.toString() ?? await execSync('git describe'))
log.debug('ToRevision', toRevision)
log.debug('Changelog Options', options)

const version = options?.version ?? options?.r
const versionFlag = version ? ` -r ${sanitizeVersion(version.toString())}` : ''
const command = options?.dryRun
  ? `bunx --bun changelogen --no-output --from ${fromRevision} --to ${toRevision}${versionFlag}`
  : `bunx --bun changelogen --output CHANGELOG.md --from ${fromRevision} --to ${toRevision}${versionFlag}`

await runCommand(command, {
  cwd: projectPath(),
  quiet: options?.quiet,
  verbose: options?.verbose,
})
