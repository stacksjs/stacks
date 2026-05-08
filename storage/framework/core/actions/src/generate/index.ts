import type { GeneratorOptions } from '@stacksjs/types'
import * as fs from 'node:fs'
import process from 'node:process'
import { runCommand } from '@stacksjs/cli'
import { Action, NpmScript } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { frameworkPath, projectPath, storagePath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { runNpmScript } from '@stacksjs/utils'
import { runAction } from '../helpers'
import { generateVsCodeCustomData as genVsCodeCustomData } from '../helpers/vscode-custom-data'

// import { files } from '@stacksjs/storage'

export async function invoke(options?: GeneratorOptions): Promise<void> {
  if (options?.types)
    await generateTypes(options)
  else if (options?.entries)
    await generateLibEntries(options)
  else if (options?.webTypes)
    await generateWebTypes(options)
  else if (options?.customData)
    await generateVsCodeCustomData()
  else if (options?.ideHelpers)
    await generateIdeHelpers(options)
  else if (options?.componentMeta)
    await generateComponentMeta()
  else if (options?.coreSymlink)
    await generateCoreSymlink()
  // else if (options?.modelFiles)
  //   await generateModelFiles()
  else if (options?.openApiSpec)
    await generateOpenApiSpec()
}

export function generate(options: GeneratorOptions): Promise<void> {
  return invoke(options)
}

export async function generateLibEntries(options: GeneratorOptions): Promise<void> {
  const result = await runAction(Action.GenerateLibraryEntries, {
    ...options,
    cwd: projectPath(),
  })

  if (result.isErr) {
    log.error('There was an error generating your library entry points', result.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Library entry points generated successfully')
}

export async function generateWebTypes(options?: GeneratorOptions): Promise<void> {
  const result = await runNpmScript(NpmScript.GenerateWebTypes, options)

  if (result.isErr) {
    log.error('There was an error generating the web-types.json file.', result.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Successfully generated the web-types.json file')
}

export async function generateVsCodeCustomData(): Promise<void> {
  const result = await genVsCodeCustomData()

  if (result.isErr) {
    log.error('There was an error generating the custom-elements.json file.', result.error)
    process.exit(ExitCode.FatalError)
  }

  await runAction(Action.LintFix, { verbose: true, cwd: projectPath() }) // because the generated json file needs to be linted

  log.success('Successfully generated the custom-elements.json file')
}

export async function generateIdeHelpers(options?: GeneratorOptions): Promise<void> {
  const result = await runNpmScript(NpmScript.GenerateIdeHelpers, options)

  if (result.isErr) {
    log.error('There was an error generating IDE helpers.', result.error)
    process.exit(ExitCode.FatalError)
  }

  await runAction(Action.LintFix, { verbose: true, cwd: projectPath() }) // because the generated json file needs to be linted
  log.success('Successfully generated IDE helpers')
}

export async function generateComponentMeta(): Promise<void> {
  const result = await genVsCodeCustomData()

  if (result.isErr) {
    log.error('There was an error generating your component meta information.', result.error)
    process.exit(ExitCode.FatalError)
  }

  await runAction(Action.LintFix, { verbose: true, cwd: projectPath() }) // because the generated json file needs to be linted
  log.success('Successfully generated component meta information')
}

export async function generateTypes(options?: GeneratorOptions): Promise<void> {
  const result = await runNpmScript(NpmScript.GenerateTypes, {
    cwd: frameworkPath(),
    ...options,
  })

  if (result.isErr) {
    log.error('There was an error generating your types.', result.error)
    // `generateTypes` is invoked both from the user-facing
    // `buddy generate:types` command (where exiting non-zero is the
    // right behaviour for CI scripts) AND from `watchTypes` running as
    // a sidecar inside `dev:api`. In the watch case, killing the
    // parent process here also kills the dev server — surfacing as
    // `Failed to execute command: bun --watch ...` and forcing a
    // restart. Throw instead, and let the caller decide whether the
    // failure is fatal: the CLI catches and exits, the watcher
    // catches and stays alive for the next file change.
    throw result.error instanceof Error ? result.error : new Error(String(result.error))
  }

  log.success('Types were generated successfully')
}

/**
 * Watch model + config + migration source for changes and re-run
 * `generateTypes()` whenever any of them change. Debounced at 200ms so
 * a refactor that touches a dozen files in one save coalesces into a
 * single regen pass.
 *
 * Watched roots:
 *   - `app/Models/`                                 — userland models
 *   - `storage/framework/defaults/app/Models/`      — framework defaults
 *     (Stacks' equivalent of Laravel's vendor/. When you're working on
 *     the framework itself you edit here and need fresh types just as
 *     much as a userland edit.)
 *   - `config/`
 *   - `database/migrations/`
 *
 * `inflight` guards against re-entry: a slow regen shouldn't queue up
 * three more behind it. `pending` debounces a burst of saves into one
 * fire. The returned promise only resolves on SIGINT, so the caller
 * either awaits (blocking, like `generate:types --watch`) or fires it
 * non-blocking (sidecar use, like `dev:api`).
 */
export async function watchTypes(options?: GeneratorOptions): Promise<void> {
  // Cheap pre-check: if `generate:types` isn't defined in the framework
  // package.json we will fail every single time a watched file changes
  // (models, config, migrations). Without this short-circuit each save
  // produced a stacktrace; before the in-line throw fix, it killed the
  // parent dev server outright. Bail with a clear warning and let the
  // dev server keep running.
  try {
    const manifestPath = `${frameworkPath()}/package.json`
    const text = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf-8') : ''
    const manifest = text ? JSON.parse(text) : {}
    if (!manifest?.scripts?.['generate:types']) {
      log.warn('[generate:types --watch] no `generate:types` script in framework package.json — type regeneration disabled. dev:api will keep running, but type definitions won\'t auto-refresh on model/config changes.')
      return
    }
  }
  catch {
    // If we can't read the manifest, fall through and let the watcher
    // run; the per-trigger try/catch below will surface the failure.
  }

  const watched = [
    projectPath('app/Models'),
    storagePath('framework/defaults/app/Models'),
    projectPath('config'),
    projectPath('database/migrations'),
  ]

  log.info(`[generate:types --watch] watching ${watched.length} directories`)

  let pending: ReturnType<typeof setTimeout> | null = null
  let inflight = false
  const trigger = (): void => {
    if (pending) clearTimeout(pending)
    pending = setTimeout(async () => {
      if (inflight) return
      inflight = true
      try {
        log.info('[generate:types --watch] change detected, regenerating…')
        await generateTypes(options)
        log.success('[generate:types --watch] types up to date')
      }
      catch (err) {
        log.error('[generate:types --watch] regeneration failed:', err)
      }
      finally {
        inflight = false
      }
    }, 200)
  }

  const watchers: fs.FSWatcher[] = []
  for (const dir of watched) {
    try {
      if (!fs.existsSync(dir)) continue
      const w = fs.watch(dir, { recursive: true }, () => trigger())
      watchers.push(w)
    }
    catch (err) {
      log.warn(`[generate:types --watch] cannot watch ${dir}: ${err}`)
    }
  }

  if (watchers.length === 0) {
    log.warn('[generate:types --watch] no directories to watch — exiting')
    return
  }

  // Hold the process open until SIGINT. When dev:api spawns this
  // fire-and-forget, the parent's SIGINT handler (or a hard kill)
  // tears down the watchers along with the dev server.
  await new Promise<void>((resolve) => {
    process.once('SIGINT', () => {
      log.info('[generate:types --watch] stopping')
      for (const w of watchers) {
        try { w.close() }
        catch { /* ignore */ }
      }
      resolve()
    })
  })
}

export function generatePantryConfig(): void {
  // write the yaml string to a file in your project root
  // files.put(projectPath('./pantry.yaml'), yamlStr)
  log.success('Successfully generated `./pantry.yaml` based on your config')
}

export async function generateSeeder(): Promise<void> {
  // await seed()
}

export async function generateCoreSymlink(): Promise<void> {
  await runCommand(`ln -s ${frameworkPath()} ${projectPath('.stacks')}`)
}

export async function generateOpenApiSpec(): Promise<void> {
  // Lazy import to avoid pulling in @stacksjs/router (and bun-router) at module load time
  const { generateOpenApi } = await import('@stacksjs/api')
  await generateOpenApi()

  log.success('Successfully generated Open API Spec')
}
