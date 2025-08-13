import { watch } from 'node:fs'
import { readdir } from 'node:fs/promises'
import process from 'node:process'
import { log, runCommandSync } from '@stacksjs/cli'
import { app, ports } from '@stacksjs/config'
import { join, path } from '@stacksjs/path'
import { Router, serve } from '@stacksjs/router'
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

// Cache invalidation utility for Bun
function invalidateModuleCache(filePath: string) {
  try {
    // Convert to absolute path
    const absolutePath = path.resolve(filePath)

    // Clear from require.cache if it exists
    if (require.cache[absolutePath]) {
      delete require.cache[absolutePath]
      log.debug(`Cleared require.cache for ${absolutePath}`)
    }

    // Also try with .js extension
    const jsPath = absolutePath.replace(/\.ts$/, '.js')
    if (require.cache[jsPath]) {
      delete require.cache[jsPath]
      log.debug(`Cleared require.cache for ${jsPath}`)
    }

    // Clear from Bun's module cache if available
    if (typeof Bun !== 'undefined' && (Bun as any).invalidate) {
      try {
        ;(Bun as any).invalidate(absolutePath)
        log.debug(`Invalidated Bun cache for ${absolutePath}`)
      }
      catch {
        log.debug(`Bun.invalidate not available or failed for ${absolutePath}`)
      }
    }

    return true
  }
  catch (error) {
    log.error(`Failed to invalidate cache for ${filePath}:`, error)
    return false
  }
}

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

  // Watch app/Actions directory for hot reloading
  watch(path.appPath('Actions'), { recursive: true }, (event: string, filename: string | null) => {
    if (filename === null)
      return

    log.info(`Detected ${event} in app/Actions/${filename}`)
    log.info('Invalidating module cache for Actions...')

    const actionPath = path.appPath(`Actions/${filename}`)
    if (invalidateModuleCache(actionPath)) {
      // Update the global cache buster to force fresh imports
      Router.updateCacheBuster()
      log.success(`Hot reloaded Action: ${filename}`)
    }
  })

  // Watch app/Actions directory for hot reloading
  watch(path.builtUserActionsPath('src'), { recursive: true }, (event: string, filename: string | null) => {
    if (filename === null)
      return

    log.info(`Detected ${event} in app/Actions/${filename}`)
    log.info('Invalidating module cache for Actions...')

    const actionPath = path.appPath(`Actions/${filename}`)
    if (invalidateModuleCache(actionPath)) {
      // Update the global cache buster to force fresh imports
      Router.updateCacheBuster()
      log.success(`Hot reloaded Action: ${filename}`)
    }
  })

  // Watch app/Controllers directory for hot reloading
  watch(path.appPath('Controllers'), { recursive: true }, (event: string, filename: string | null) => {
    if (filename === null)
      return

    log.info(`Detected ${event} in app/Controllers/${filename}`)
    log.info('Invalidating module cache for Controllers...')

    const controllerPath = path.appPath(`Controllers/${filename}`)
    if (invalidateModuleCache(controllerPath)) {
      // Update the global cache buster to force fresh imports
      Router.updateCacheBuster()
      log.success(`Hot reloaded Controller: ${filename}`)
    }
  })

  // Watch app/Middleware directory for hot reloading
  watch(path.appPath('Middleware'), { recursive: true }, (event: string, filename: string | null) => {
    if (filename === null)
      return

    log.info(`Detected ${event} in app/Middleware/${filename}`)
    log.info('Invalidating module cache for Middleware...')

    const middlewarePath = path.appPath(`Middleware/${filename}`)
    if (invalidateModuleCache(middlewarePath)) {
      // Update the global cache buster to force fresh imports
      Router.updateCacheBuster()
      log.success(`Hot reloaded Middleware: ${filename}`)
    }
  })

  // Watch user models for ORM generation
  watch(path.userModelsPath(), { recursive: true }, (event: string, filename: string | null) => {
    if (filename === null)
      return

    log.info(`Detected ${event} in user models/${filename}`)
    log.info('Generating ORM model files...')

    runCommandSync('./buddy generate:model-files', {
      cwd: process.cwd(), // Run at root directory
    })

    log.success(`Generated ORM model files for: ${filename}`)
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
