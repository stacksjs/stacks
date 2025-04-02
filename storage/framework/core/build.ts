import { log, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { exists, glob } from '@stacksjs/storage'
import { version } from './package.json'

const componentsDir = p.resolve('./components')

// Get base directories excluding components
const dirs = await glob([p.resolve('./', '*'), `!${componentsDir}`], {
  onlyDirectories: true,
  absolute: true,
  deep: 1,
})
dirs.sort((a, b) => a.localeCompare(b))

// Get component directories directly
const components = await glob('./components/*', {
  onlyDirectories: true,
  absolute: true,
})
// console.log('components', components)
dirs.push(...components)

const startTime = Date.now()

for (const dir of dirs) {
  if (dir.includes('bun-create') || dir.includes('dist') || dir.includes('core/desktop'))
    continue

  console.log(`Building ${dir}`)
  const distPath = p.resolve(dir, 'dist')

  if (await exists(distPath)) {
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
const packageJson = await Bun.file(packageJsonPath).json()

// Find all workspace:* dependencies in the main package.json and update them to use the current version
for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
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
await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, 2))

const endTime = Date.now()
const timeTaken = endTime - startTime

log.success(`Build took ${timeTaken}ms`)
