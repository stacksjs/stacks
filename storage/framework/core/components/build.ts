import { log, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { exists, glob } from '@stacksjs/storage'

const dirs = await glob([p.resolve('./', '*')], { onlyDirectories: true, absolute: true })
dirs.sort((a, b) => a.localeCompare(b))

const startTime = Date.now()

console.log('dirs', dirs)
for (const dir of dirs) {
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

  const tempPath = p.resolve(dir, 'temp')

  // Check if the dist folder exists
  if (await exists(tempPath)) {
    await runCommand('rm -rf dist', {
      cwd: dir, // Change this to 'dir' to correctly set the working directory
    })
  }
}

const endTime = Date.now()
const timeTaken = endTime - startTime

log.success(`Build took ${timeTaken}ms`)
