import { readFileSync, writeFileSync } from 'node:fs'
import { log } from '@stacksjs/cli'
import { buildWorkspacePackages, workspaceBuildTargets } from './build/src/workspace'
import { version } from './package.json'

const startTime = Date.now()
const root = import.meta.dir
const results = await buildWorkspacePackages(workspaceBuildTargets(root).filter(dir => dir !== root))
const failed = results.filter(result => result.exitCode !== 0)
if (failed.length)
  throw new Error(`Framework builds failed or were blocked: ${failed.map(result => result.name).join(', ')}`)

// Update the package.json workspace:* references to the specific version
const packageJsonPath = './package.json'
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

let updated = false

// Find all workspace:* dependencies in the main package.json and update them to use the current version
for (const section of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
  if (!packageJson[section])
    continue

  for (const [dep, depVersion] of Object.entries(packageJson[section])) {
    // Update all workspace:* references to use the current version
    if (depVersion === 'workspace:*') {
      packageJson[section][dep] = `^${version}`
      updated = true
      log.debug(`Updated ${dep} from 'workspace:*' to '^${version}'`)
    }
  }
}

// Write the updated package.json back to the file.
//
// Only write when a reference actually changed, and keep the trailing newline
// the file is committed with. The unconditional `JSON.stringify` write stripped
// that newline on every build, so a plain `bun run build` left package.json
// showing as modified in `git status` - a stray diff to revert by hand each
// time, or to accidentally commit.
if (updated)
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

// The umbrella ships its own public entrypoints, delegating to the declared
// packages instead of referring to sibling directories excluded by npm.
await import('./build-exports')

const endTime = Date.now()
const timeTaken = endTime - startTime

log.success(`Build took ${timeTaken}ms`)
