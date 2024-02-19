import process from 'node:process'
import { watch } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { app } from '@stacksjs/config'
import { serve } from '@stacksjs/router'
import { join, path } from '@stacksjs/path'
import { italic, log, runCommandSync } from '@stacksjs/cli'

declare global {
  let counter: number
}

// @ts-expect-error - somehow type is not recognized
globalThis.counter ??= 0
// @ts-expect-error - somehow type is not recognized
log.debug(`Reloaded ${globalThis.counter} times`)
// @ts-expect-error - somehow type is not recognized
globalThis.counter++

async function watchFolders() {
  const coreDirectories = await readdir(path.corePath(), { withFileTypes: true })
  coreDirectories.forEach((dir) => {
    // Skip the directory named 'bun-create' -> no need to build
    if (dir.name === 'bun-create')
      return

    if (dir.isDirectory()) {
      log.debug(`Watching ${dir.name} for changes ...`)

      const srcPath = join(path.corePath(), dir.name, 'src')
      watch(srcPath, { recursive: true }, (event: string, filename: string | null) => {
        if (filename === null)
          return

        log.info(`Detected ${event} in ./core/${filename}`)
        log.info(`Rebuilding package ...`)
        log.debug(`Rebuilding:`, process.cwd(), srcPath, filename)

        runCommandSync('bun run build', {
          cwd: path.corePath(dir.name),
        })
      })
    }
  })

  watch(path.routesPath(), (event: string, filename: string | null) => {
    if (filename === null)
      return

    log.info(`Detected ${event} in ./routes/${filename}`)
  })
}

// @ts-expect-error - somehow type is not recognized
if (globalThis.counter === 1)
  watchFolders().catch(log.error)
else
  log.debug(`Skipping watching folders`)

serve({
  port: 3999,
  timezone: app.timezone || 'UTC',
})

process.on('SIGINT', () => {
  log.info(`Exited ${italic('using Ctrl-C')}`)

  process.exit()
})

// @ts-expect-error - somehow type is not recognized
if (globalThis.counter === 1)
  log.info(`Listening on http://localhost:3999/api ...`)
else // @ts-expect-error - somehow type is not recognized
  log.info(`#${globalThis.counter}: Listening on http://localhost:3999/api ...`)
