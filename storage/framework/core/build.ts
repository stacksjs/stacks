import { path as p } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'
import { dim, log, runCommand } from '@stacksjs/cli'

const dirs = await glob(p.resolve('./', '*'), { onlyDirectories: true })
dirs.sort((a, b) => a.localeCompare(b))

const startTime = Date.now()

for (const dir of dirs) {
  if (dir.includes('bun-create'))
    continue

  log.info(`Building ${dir}...`)

  const startTime = Date.now()

  // Run the build command in each directory
  await runCommand('bun run build', {
    cwd: dir,
  })

  const endTime = Date.now()
  const timeTaken = endTime - startTime

  log.success(`${dim(`[${timeTaken}ms]`)} Built ${dir}`)
}

const endTime = Date.now()
const timeTaken = endTime - startTime

log.success(`Build took ${timeTaken}ms`)
