import { log, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { exists, glob } from '@stacksjs/storage'

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

console.log('dirs', dirs)
const startTime = Date.now()

for (const dir of dirs) {
  if (dir.includes('bun-create') || dir.includes('dist'))
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

const endTime = Date.now()
const timeTaken = endTime - startTime

log.success(`Build took ${timeTaken}ms`)
