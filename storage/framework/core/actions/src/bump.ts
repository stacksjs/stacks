import { execSync, log, parseOptions, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { join, relative } from 'node:path'

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

async function resolveBumpArg(bump: string | null): Promise<string | null> {
  if (!bump || /^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(bump))
    return bump

  if (!['patch', 'minor', 'major'].includes(bump))
    return bump

  const pkg = await Bun.file(p.frameworkPath('core/package.json')).json() as { version?: string }
  const match = pkg.version?.match(/^(\d+)\.(\d+)\.(\d+)$/)

  if (!match)
    return bump

  const [, major, minor, patch] = match.map(Number)
  if (bump === 'major')
    return `${major + 1}.0.0`

  if (bump === 'minor')
    return `${major}.${minor + 1}.0`

  return `${major}.${minor}.${patch + 1}`
}

const resolvedBumpArg = await resolveBumpArg(bumpArg)
const isDryRun = options?.dryRun === true

async function runOrFail(command: string, commandOptions: Parameters<typeof runCommand>[1]): Promise<void> {
  const result = await runCommand(command, commandOptions)

  if (result.isErr)
    throw result.error
}

async function git(args: string[], cwd = p.projectPath()): Promise<string> {
  return await execSync(['git', ...args], {
    cwd,
    stdin: 'inherit',
  })
}

async function readFrameworkVersion(): Promise<string> {
  const pkg = await Bun.file(p.frameworkPath('core/package.json')).json() as { version?: string }

  if (!pkg.version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version))
    throw new Error(`Invalid framework version in package.json: ${pkg.version ?? '<missing>'}`)

  return pkg.version
}

// Use the project-root `./buddy` shell wrapper (bun + src/cli.ts) instead
// of the `buddy` PATH lookup, which resolves to `pantry/.bin/buddy` — a
// `node dist/cli.js` shim that breaks when @stacksjs/actions/dist hasn't
// been rebuilt. The project wrapper always uses live source.
const buddyBin = p.projectPath('buddy')

const bumpCwd = p.frameworkPath('core')

async function packageFilesFor(pattern: string, cwd: string): Promise<string[]> {
  const glob = new Bun.Glob(pattern)
  const files: string[] = []

  for await (const file of glob.scan({ cwd, absolute: true, onlyFiles: true })) {
    if (file.includes('/node_modules/') || file.includes('/dist/') || file.includes('/pantry/'))
      continue

    files.push(`./${relative(bumpCwd, file)}`)
  }

  return files
}

async function existingPackageFiles(files: string[]): Promise<string[]> {
  const existing: string[] = []

  for (const file of files) {
    const absolutePath = join(bumpCwd, file)
    if (await Bun.file(absolutePath).exists())
      existing.push(file)
  }

  return existing
}

// Build an explicit file list instead of passing globs through to bumpx. The
// release workflow previously treated a few glob targets as literal paths,
// leaving publishable core packages at the previous version.
const bumpFileSet = new Set([
  ...(await packageFilesFor('package.json', bumpCwd)),
  ...(await packageFilesFor('*/package.json', bumpCwd)),
  ...(await packageFilesFor('*/*/package.json', bumpCwd)),
  ...(await existingPackageFiles([
    '../package.json',
    '../defaults/ide/vscode/package.json',
    '../api/package.json',
    '../cloud/package.json',
    '../docs/package.json',
    '../orm/package.json',
    '../server/package.json',
  ])),
  ...(await packageFilesFor('../libs/**/package.json', bumpCwd)),
])
const bumpFiles = Array.from(bumpFileSet).join(',')

// `--all` stages every change in the cwd; `--no-push` keeps dry-runs local.
// `--yes` skips the confirm prompt when the bump type is supplied
// non-interactively. Forward --verbose so dry-runs print every file bumpx
// would touch (otherwise it just prints a summary line and you can't tell
// what got matched).
const flags: string[] = ['--no-commit', '--no-tag', '--no-push', '--no-recursive', '--no-changelog']
if (isDryRun) flags.push('--dry-run')
if (resolvedBumpArg) flags.push('--yes')
if ((options as { verbose?: boolean })?.verbose) flags.push('--verbose')

// `--files <list>` must not be wrapped in quotes — runCommand's regex
// tokeniser preserves quotes literally, which would land `"./pkg.json,...`
// (with the leading `"`) inside bumpx as a single bogus path. Since the
// list is comma-separated with no spaces it tokenises cleanly without them.
const bumpCommand = `bunx --bun bumpx ${resolvedBumpArg ? `${resolvedBumpArg} ` : ''}--files ${bumpFiles} ${flags.join(' ')}`

log.debug(`Running: ${bumpCommand}`)
log.debug(`Bumping ${bumpFiles.split(',').filter(Boolean).length} package manifest(s)`)
log.debug(`In frameworkPath: ${p.frameworkPath()}`)

await runOrFail(bumpCommand, {
  cwd: bumpCwd,
  stdin: 'inherit',
})

const latestTag = (await git(['describe', '--abbrev=0', '--tags'])).trim()
const nextVersion = isDryRun && resolvedBumpArg && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(resolvedBumpArg)
  ? resolvedBumpArg
  : await readFrameworkVersion()
const changelogCommand = isDryRun
  ? `${buddyBin} changelog --quiet --dry-run --from ${latestTag} --to HEAD --version ${nextVersion}`
  : `${buddyBin} changelog --quiet --from ${latestTag} --to HEAD --version ${nextVersion}`

await runOrFail(changelogCommand, {
  cwd: p.projectPath(),
  stdin: 'inherit',
})

if (!isDryRun) {
  await git(['add', '--all'])
  await git(['commit', '-m', `chore: release v${nextVersion}`])
  await git(['tag', `v${nextVersion}`])
  await git(['push'])
  await git(['push', 'origin', `v${nextVersion}`])
}
