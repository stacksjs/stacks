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

// Get component directories directly
// const components = await glob('./components/*', {
//   onlyDirectories: true,
//   absolute: true,
// })
// // console.log('components', components)
// dirs.push(...components)

const startTime = Date.now()

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

  console.log(`Building ${dir}`)
  const distPath = p.resolve(dir, 'dist')

  if (existsSync(distPath)) {
    await runCommand('rm -rf dist', {
      cwd: dir,
    })
  }

  log.debug(`Cleaned dist folder`)

  await runCommand('bun run build', {
    cwd: dir,
  })
}

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
      console.log(`Updated ${dep} from 'workspace:*' to '^${version}'`)
    }
  }
}

// Write the updated package.json back to the file
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))

const endTime = Date.now()
const timeTaken = endTime - startTime

log.success(`Build took ${timeTaken}ms`)
