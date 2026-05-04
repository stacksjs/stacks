import { log, parseOptions, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

const options = parseOptions() as { dryRun?: boolean, bump?: string } | undefined

// Accept --bump patch|minor|major|<explicit-version>; without it, bumpx prompts
// interactively. The `release:patch` / `release:minor` / `release:major` npm
// shortcuts at the project root pipe through to here non-interactively.
const allowedBumps = new Set(['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease'])
const rawBump = options?.bump?.toString()
const bumpArg = rawBump
  ? (allowedBumps.has(rawBump) || /^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(rawBump) ? rawBump : null)
  : null
if (rawBump && !bumpArg)
  log.warn(`Ignoring invalid --bump "${rawBump}"; expected one of patch|minor|major or x.y.z`)

// Use the project-root `./buddy` shell wrapper (bun + src/cli.ts) instead
// of the `buddy` PATH lookup, which resolves to `pantry/.bin/buddy` — a
// `node dist/cli.js` shim that breaks when @stacksjs/actions/dist hasn't
// been rebuilt. The project wrapper always uses live source.
const buddyBin = p.projectPath('buddy')
const changelogCommand = options?.dryRun
  ? `${buddyBin} changelog --quiet --dry-run`
  : `${buddyBin} changelog --quiet`

// File list covers every publishable package.json across the monorepo.
// cwd is `framework/core`, so `./**/package.json` walks every core/<pkg>
// (catches the i18n / development / deploy orphans bumpp used to miss),
// then explicit paths handle the framework/<sibling> packages. Stale
// targets (../email, ../system-tray, ../views) were dropped — those
// directories never existed and made bumpx warn on every run.
// Comma-separated; bumpx expands the globs and dedupes.
const bumpFiles = [
  './package.json',
  './**/package.json',
  '../package.json',
  '../defaults/ide/vscode/package.json',
  '../api/package.json',
  '../cloud/package.json',
  '../docs/package.json',
  '../orm/package.json',
  '../server/package.json',
  '../libs/**/package.json',
].join(',')

// `--all` stages every change in the cwd; `--no-push` keeps dry-runs local.
// `-r` keeps workspace packages in lockstep. `--yes` skips the confirm prompt
// when the bump type is supplied non-interactively. Forward --verbose so
// dry-runs print every file bumpx would touch (otherwise it just prints a
// summary line and you can't tell what got matched).
const flags: string[] = ['-r', '--all']
if (options?.dryRun) flags.push('--dry-run', '--no-push')
if (bumpArg) flags.push('--yes')
if ((options as { verbose?: boolean })?.verbose) flags.push('--verbose')

// `--files <list>` must not be wrapped in quotes — runCommand's regex
// tokeniser preserves quotes literally, which would land `"./pkg.json,...`
// (with the leading `"`) inside bumpx as a single bogus path. Since the
// list is comma-separated with no spaces it tokenises cleanly without them.
const bumpCommand = `bunx --bun bumpx ${bumpArg ? `${bumpArg} ` : ''}--files ${bumpFiles} ${flags.join(' ')}`

log.debug(`Running: ${bumpCommand}`)
log.debug(`In frameworkPath: ${p.frameworkPath()}`)

await runCommand(bumpCommand, {
  cwd: p.frameworkPath('core'),
  stdin: 'inherit',
})

await runCommand(changelogCommand, {
  cwd: p.projectPath(),
  stdin: 'inherit',
})
