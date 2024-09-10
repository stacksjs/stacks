import { log, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { exists, glob } from '@stacksjs/storage'

// import { $ } from 'bun'

const dirs = await glob([p.resolve('./', '*')], { onlyDirectories: true, absolute: true })
dirs.sort((a, b) => a.localeCompare(b))

const startTime = Date.now()

for (const dir of dirs) {
  // bun-create has only nested dirs, no need to build
  if (dir.includes('bun-create') || dir.includes('components') || dir.includes('dist')) continue

  // rm the dist folder before building
  // await $`rm -rf ${p.resolve(dir, 'dist')}`
  const distPath = p.resolve(dir, 'dist')

  // Check if the dist folder exists
  if (await exists(distPath)) {
    await runCommand('rm -rf dist', {
      cwd: dir, // Change this to 'dir' to correctly set the working directory
    })
  }

  log.debug(`Cleaned dist folder`)

  // Run the build command in each directory
  await runCommand('bun run build', {
    cwd: dir,
  })
}

const endTime = Date.now()
const timeTaken = endTime - startTime

log.success(`Build took ${timeTaken}ms`)
