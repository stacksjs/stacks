import process from 'node:process'
import { watch } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { app } from '@stacksjs/config'
import { serve } from '@stacksjs/router'
import { join, path } from '@stacksjs/path'
import { italic, log, runCommandSync } from '@stacksjs/cli'

declare global {
  var count: number
}

globalThis.count ??= 0
log.debug(`Reloaded ${globalThis.count} times`)
globalThis.count++

async function watchFolders() {
  const coreDirectories = await readdir(path.corePath(), { withFileTypes: true })
  coreDirectories.forEach((dir) => {
    // Skip the directory named 'bun-create' or 'zsh-buddy' -> no need to build them
    if (dir.name === 'bun-create' || dir.name === 'zsh-buddy')
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

if (globalThis.count === 1)
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

if (globalThis.count === 1)
  log.info(`Listening on http://localhost:3999...`)
else
  log.info(`#${globalThis.count}: Listening on http://localhost:3999...`)
