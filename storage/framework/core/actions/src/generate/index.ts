import type { GeneratorOptions } from '@stacksjs/types'
import * as fs from 'node:fs'
import process from 'node:process'
import { runCommand } from '@stacksjs/cli'
import { Action, NpmScript } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { frameworkPath, projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { runNpmScript } from '@stacksjs/utils'
import { runAction } from '../helpers'
import { generateVsCodeCustomData as genVsCodeCustomData, generateWebTypes as genWebTypes } from '../helpers/vscode-custom-data'
import { generateProjectImages } from './images'
import { generateRouteNames } from './action-types'

export { generateProjectImages } from './images'
export type { GenerateImagesActionOptions } from './images'

// Vitess keyspace VSchema, derived from the model relationship graph.
export { generateVSchema } from './vschema'
export type { GenerateVSchemaOptions, GenerateVSchemaResult } from './vschema'

// import { files } from '@stacksjs/storage'

export async function invoke(options?: GeneratorOptions): Promise<void> {
  if (options?.types)
    await generateTypes(options)
  else if (options?.entries)
    await generateLibEntries(options)
  else if (options?.webTypes)
    await generateWebTypes()
  else if (options?.customData)
    await generateVsCodeCustomData()
  else if (options?.ideHelpers)
    await generateIdeHelpers()
  else if (options?.componentMeta)
    await generateComponentMeta()
  else if (options?.coreSymlink)
    await generateCoreSymlink()
  // else if (options?.modelFiles)
  //   await generateModelFiles()
  else if (options?.openApiSpec)
    await generateOpenApiSpec()
  else if (options?.images)
    await generateProjectImages({ verbose: options?.verbose })
  else
    await generateEverything(options)
}

/**
 * `buddy generate` with no flag selected.
 *
 * The chain above is a flag-gated `else if`, so no flag meant no branch: the
 * command did its nothing and exited 0. That is the behaviour AGENTS.md already
 * documents against ("Regenerate with `buddy generate`"), and it silently
 * defeats any freshness check built on it - regenerate-then-diff cannot fail
 * when the regenerate step is a no-op.
 *
 * Runs the generators that produce committed, deterministic artifacts. Images
 * are excluded deliberately: they are expensive, they reach for external
 * services, and they have their own `--images` flag.
 */
async function generateEverything(options?: GeneratorOptions): Promise<void> {
  log.info('Generating types, entry points, component meta and the OpenAPI spec...')

  // Types first: the name registries it refreshes are what the later
  // generators read, so the order is a dependency rather than a preference.
  await generateTypes({ ...options, types: true })
  await generateLibEntries({ ...options, entries: true })
  await generateOpenApiSpec()

  /*
   * The remaining generators are reachable by their own flag but deliberately
   * not run here, because each is currently broken and this command is supposed
   * to succeed:
   *
   * - `--web-types`, `--ide-helpers` and `--custom-data` shell out to npm
   *   scripts (`generate:web-types`, `generate:ide-helpers`,
   *   `generate:custom-data`) that are defined in no package.json in the repo,
   *   so all three fail on invocation.
   * - `--component-meta` rewrites `core/custom-elements.json` with
   *   `"tags": undefined` - not valid JSON. `JSON.stringify(undefined)` returns
   *   `undefined` rather than a string, and the template interpolates it
   *   literally. It only misbehaves inside the CLI: `library.webComponents.tags`
   *   resolves in a plain Bun process and is undefined there, so the guard the
   *   same file already uses for web-types (`?? []`) would paper over a config
   *   resolution difference rather than fix it.
   *
   * Tracked in stacksjs/stacks#2411.
   */

  log.success('Generated')
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

export async function generateWebTypes(): Promise<void> {
  /*
   * Calls the implementation instead of shelling out to `generate:web-types`,
   * an npm script defined in no package.json in the repo (stacksjs/stacks#2411).
   * The work was always here, in `helpers/vscode-custom-data.ts`; the wrapper
   * just never reached it.
   *
   * It did not even fail cleanly: `runNpmScript` printed "the script does not
   * exist" and returned Ok, so this logged success over a file it never wrote.
   */
  await genWebTypes()
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

export async function generateIdeHelpers(): Promise<void> {
  // Same as above: `generate:ide-helpers` is not a script that exists, and the
  // two files it was supposed to produce are produced right here
  // (stacksjs/stacks#2411).
  await genWebTypes()
  await genVsCodeCustomData()

  await runAction(Action.LintFix, { verbose: true, cwd: projectPath() }) // because the generated json files need to be linted
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
  /*
   * `storage/framework/package.json` is the framework's own development
   * manifest, and it gets vendored into every app. Its `generate:types` script
   * runs `./core/actions/src/generate/types.ts` — a path that exists in a full
   * checkout and nowhere else, because an app installs the framework from npm
   * and has no `core/` directory at all.
   *
   * So this crashed on every app: `Module not found "./core/actions/src/
   * generate/types.ts"`, surfaced as a stack trace and a non-zero exit from
   * `buddy generate:types`, and as a repeating failure inside `dev:api`'s
   * watcher.
   *
   * The generator is a module in this very package, so import it rather than
   * spawning a subprocess through a manifest that may not describe the
   * installed layout. A cache-busting query keeps the watch case working:
   * `types.ts` does its work at module scope, and a plain re-import would be
   * served from the module cache and silently do nothing the second time.
   */
  /*
   * Environment variables are NOT generated. `config/env.ts` declares them with
   * `defineEnv`, and `storage/framework/types/env.d.ts` reads that schema to
   * extend `StacksEnv` - so a variable is typed from its validator, the same on
   * a fresh clone, in CI and in production.
   *
   * There was a generator here. It wrote a `Bun.env` namespace whose key set
   * came from whichever `.env` happened to be on the machine that ran it, and
   * whose types were read off each variable's LIVE VALUE - so the same variable
   * could be `number` here and `string` on a colleague's checkout, a
   * production-only variable could never be typed at all, and `DEBUG` was
   * declared `boolean` when `Bun.env.DEBUG` is the string `'false'`, which is
   * truthy. Nothing in the framework or the application read `Bun.env.X`
   * through it.
   */

  /*
   * The name registries: actions, listeners, policies, middleware, jobs,
   * models, email templates.
   *
   * These are runtime maps under `storage/framework/auto-imports/`, and the
   * name types are `keyof` over them - so this IS generating the types, by the
   * only means that keeps them honest. Refreshing them here matters: they were
   * written at dev-server boot and nowhere else, so somebody who added an
   * action and ran `buddy generate:types` would have been told it does not
   * exist, which is the drift the generated `actions.d.ts` used to have,
   * reintroduced one level down.
   */
  try {
    const { generateAutoImportFiles } = await import('@stacksjs/server')
    await generateAutoImportFiles()
  }
  catch (error) {
    log.debug('[generate:types] Could not refresh the auto-import registries', { error })
  }

  // Route names last, because loading the route table needs the registries
  // above: a route file names an action, and the resolver reads the map.
  await generateRouteNames()

  /*
   * Model events are NOT generated. `types/model-events.d.ts` derives them from
   * the models barrel with a mapped type, so `User` becoming a model is the
   * same fact as `'user:created'` existing rather than two things that have to
   * be kept in agreement. There was a generator here; 817 lines of output that
   * a mapped type produces for free.
   */

  /*
   * The server auto-import declarations, which describe every global the
   * runtime injects.
   *
   * These have always been derived from disk - the problem was WHEN. The header
   * says "regenerated automatically when the API starts", and that was the only
   * thing that regenerated them, so a fresh checkout, a CI typecheck or any
   * `buddy typecheck` before the first `buddy dev` read whatever the last
   * developer's API run happened to leave behind. Generating types is exactly
   * when they should be rebuilt.
   *
   * Best-effort: a project without models still has a types directory, and
   * failing to refresh a declaration is not a reason to fail the whole command.
   */
  try {
    const { generateServerAutoImportTypes } = await import('@stacksjs/server')
    await generateServerAutoImportTypes()
  }
  catch (error) {
    log.debug('[generate:types] Could not refresh server auto-import declarations', { error })
  }

  const entry = frameworkPath('core/actions/src/generate/types.ts')

  if (!fs.existsSync(entry)) {
    await import(`./types?t=${Date.now()}`)
    return
  }

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
      log.warn('[generate:types --watch] no `generate:types` script in framework package.json - type regeneration disabled. dev:api will keep running, but type definitions won\'t auto-refresh on model/config changes.')
      return
    }
  }
  catch {
    // If we can't read the manifest, fall through and let the watcher
    // run; the per-trigger try/catch below will surface the failure.
  }

  /*
   * Every directory a generated type is built from.
   *
   * `autoImportSourceDirs()` is the same list the staleness check uses, so the
   * watcher and the "is it out of date" check cannot disagree about what the
   * registries are derived from. It covers actions, listeners, policies,
   * middleware, jobs, models and email templates.
   *
   * `routes/` and `app/Routes.ts` are added on top: route NAMES are the one
   * thing that cannot be read off the filesystem - a name is attached by a
   * chained `.name()` whose path may come from a group prefix - so
   * `generateRouteNames()` loads the route table, and it has to re-load it when
   * a route file changes. Without this, adding `.name('users.show')` and then
   * writing `url('users.show')` was a type error until somebody ran
   * `buddy generate:types` by hand.
   *
   * Nothing here is written to by the regeneration, which writes into
   * `storage/framework/{auto-imports,types}/` - so there is no loop.
   */
  const registrySources = await (async (): Promise<string[]> => {
    try {
      const { autoImportSourceDirs } = await import('@stacksjs/server')
      return autoImportSourceDirs()
    }
    catch {
      // Without the server package there are no registries to refresh; the
      // model/config/route watchers below still apply.
      return []
    }
  })()

  const watched = [
    ...registrySources,
    projectPath('config'),
    projectPath('database/migrations'),
    // `app/` recursively, which covers `app/Routes.ts` and anything the
    // registries are built from that `autoImportSourceDirs()` did not name.
    // The 200ms debounce coalesces the overlap into one regeneration.
    projectPath('app'),
    projectPath('routes'),
  ].filter((dir, index, all) => all.indexOf(dir) === index)

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
    log.warn('[generate:types --watch] no directories to watch - exiting')
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

/**
 * Drops a `.framework` symlink in the project root pointing at
 * `storage/framework`, so core developers can `cd .framework` instead of typing
 * the full path. Purely a convenience; nothing in the framework depends on it.
 *
 * It used to be called `.stacks`, which now collides with the pre-relocation
 * name of the runtime scratch directory (see `ensureRuntimeDirectories`).
 */
export async function generateCoreSymlink(): Promise<void> {
  const link = projectPath('.framework')

  if (fs.existsSync(link))
    await runCommand(`rm -f ${link}`)

  await runCommand(`ln -s ${frameworkPath()} ${link}`)
}

export async function generateOpenApiSpec(): Promise<void> {
  // Lazy import to avoid pulling in @stacksjs/router (and bun-router) at module load time
  const { generateOpenApi } = await import('@stacksjs/api')
  await generateOpenApi()

  log.success('Successfully generated Open API Spec')
}
