import { watch } from 'node:fs'
import { readdir } from 'node:fs/promises'
import process from 'node:process'
import { log, runCommandSync } from '@stacksjs/cli'
import { app, ports } from '@stacksjs/config'
import { join, path } from '@stacksjs/path'
import { serve } from '@stacksjs/router'
import { handleEvents } from '../../../app/Listener'

declare global {
  let counter: number
}

// @ts-expect-error - type is not recognized but is present
globalThis.counter ??= 0
// @ts-expect-error - type is not recognized but is present
log.debug(`Reloaded ${globalThis.counter} times`)
// @ts-expect-error - type is not recognized but is present
globalThis.counter++

async function watchFolders() {
  const coreDirectories = await readdir(path.corePath(), {
    withFileTypes: true,
  })

  coreDirectories.forEach((dir) => {
    const ignore = ['dist', 'bun-create', 'lint', 'components']

    // no need to build these directories
    if (ignore.includes(dir.name))
      return

    if (dir.isDirectory()) {
      log.debug(`Watching ${dir.name} for changes ...`)

      const srcPath = join(path.corePath(), dir.name, 'src')
      watch(srcPath, { recursive: true }, (event: string, filename: string | null) => {
        if (filename === null)
          return

        log.info(`Detected ${event} in ./core/${filename}`)
        log.info(`Rebuilding package ...`)
        log.debug(`Rebuilding:`, process.cwd())

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
else log.debug(`Skipping watching folders`)

serve({
  port: ports.api || 3008,
  timezone: app.timezone || 'UTC',
})

handleEvents()

process.on('SIGINT', () => {
  log.info(`Exited using Ctrl-C`)
  process.exit()
})

// @ts-expect-error - somehow type is not recognized
if (globalThis.counter === 1)
  log.info(`Listening on http://localhost:${ports.api} ...`)
// @ts-expect-error - somehow type is not recognized
else log.info(`#${globalThis.counter}: Listening on http://localhost:${ports.api} ...`)
