import { log, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { exists, glob } from '@stacksjs/storage'

// Only get immediate subdirectories of the current directory
const dirs = await glob(['./*'], {
  onlyDirectories: true,
  absolute: true,
  deep: 1, // Only look one level deep
})
dirs.sort((a, b) => a.localeCompare(b))

console.log('Directories to build:', dirs)

const startTime = Date.now()

for (const dir of dirs) {
  // Skip the build if package.json doesn't exist
  const packageJsonPath = p.resolve(dir, 'package.json')
  if (!await exists(packageJsonPath)) {
    console.log(`Skipping ${dir} - no package.json found`)
    continue
  }

  console.log(`Building ${dir}`)
  const distPath = p.resolve(dir, 'dist')

  // Check if the dist folder exists
  if (await exists(distPath)) {
    console.log(`Cleaning dist folder in ${dir}`)
    await runCommand('rm -rf dist', {
      cwd: dir,
    })
  }

  // Run the build command in each directory
  try {
    await runCommand('bun run build', {
      cwd: dir,
    })
    console.log(`Successfully built ${dir}`)
  }
  catch (error) {
    console.error(`Failed to build ${dir}:`, error)
    continue // Continue with next directory even if this one fails
  }

  const tempPath = p.resolve(dir, 'temp')

  // Check if the temp folder exists
  if (await exists(tempPath)) {
    console.log(`Cleaning temp folder in ${dir}`)
    await runCommand('rm -rf temp', {
      cwd: dir,
    })
  }
}

const endTime = Date.now()
const timeTaken = endTime - startTime

log.success(`Build took ${timeTaken}ms`)
