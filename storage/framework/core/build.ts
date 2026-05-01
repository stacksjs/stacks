import { availableParallelism } from 'node:os'
import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import * as storage from '@stacksjs/storage'
import { version } from './package.json'

const { existsSync, globSync, readFileSync, writeFileSync } = storage as unknown as {
  existsSync: (path: string) => boolean
  globSync: (patterns: string | string[], options?: Record<string, unknown>) => string[]
  readFileSync: (path: string, encoding: string) => string
  writeFileSync: (path: string, data: string) => void
}

const componentsDir = p.resolve('./components')
const dirs = globSync([p.resolve('./', '*'), `!${componentsDir}`], {
  onlyDirectories: true,
  absolute: true,
  deep: 1,
})
dirs.sort((a: string, b: string) => a.localeCompare(b))

const startTime = Date.now()

// Filter to packages that actually have a build script. Doing this once
// avoids re-reading the manifest inside the worker pool.
interface BuildableDir { dir: string }
const buildable: BuildableDir[] = []
for (const dir of dirs) {
  if (dir.includes('bun-create') || dir.includes('dist') || dir.includes('core/desktop'))
    continue

  const packagePath = p.resolve(dir, 'package.json')
  if (!existsSync(packagePath)) {
    log.debug(`Skipping ${dir} (no package.json)`)
    continue
  }

  const manifestContent = readFileSync(packagePath, 'utf8')
  const manifest = JSON.parse(manifestContent) as { scripts?: Record<string, string> }
  if (!manifest.scripts?.build) {
    log.debug(`Skipping ${dir} (no build script)`)
    continue
  }

  buildable.push({ dir })
}

// Parallel build pool. Capped at the lower of (availableParallelism, 6)
// because each `bun run build` itself spawns parallel workers internally;
// going wider just thrashes the I/O. Override with `STACKS_BUILD_CONCURRENCY=N`.
const envConc = Number.parseInt(process.env.STACKS_BUILD_CONCURRENCY ?? '', 10)
const concurrency = Number.isFinite(envConc) && envConc > 0
  ? envConc
  : Math.max(1, Math.min(availableParallelism(), 6))

log.info(`Building ${buildable.length} packages with concurrency ${concurrency}`)

let cursor = 0
async function buildOne(item: BuildableDir): Promise<void> {
  const { dir } = item
  const distPath = p.resolve(dir, 'dist')
  if (existsSync(distPath)) {
    await runCommand('rm -rf dist', { cwd: dir })
  }
  // Each builder logs `Building <dir>` itself so concurrent output stays
  // attributable. We deliberately don't pre-print here.
  console.log(`Building ${dir}`)
  await runCommand('bun run build', { cwd: dir })
}

async function worker(): Promise<void> {
  while (cursor < buildable.length) {
    const idx = cursor++
    const item = buildable[idx]
    if (!item) return
    try {
      await buildOne(item)
    }
    catch (err) {
      // Surface the failing package — without this the only signal was
      // a non-zero exit from `runCommand`, which is hard to attribute
      // when 6 builds are interleaved on the same terminal.
      log.error(`[build] Failed in ${item.dir}: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))

// Update the package.json workspace:* references to the specific version
const packageJsonPath = './package.json'
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

// Find all workspace:* dependencies in the main package.json and update them to use the current version
for (const section of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
  if (!packageJson[section])
    continue

  for (const [dep, depVersion] of Object.entries(packageJson[section])) {
    // Update all workspace:* references to use the current version
    if (depVersion === 'workspace:*') {
      packageJson[section][dep] = `^${version}`
      log.debug(`Updated ${dep} from 'workspace:*' to '^${version}'`)
    }
  }
}

// Write the updated package.json back to the file
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))

const endTime = Date.now()
const timeTaken = endTime - startTime

log.success(`Build took ${timeTaken}ms`)
