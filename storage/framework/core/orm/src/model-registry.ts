import type { Dirent } from 'node:fs'
import type { ModelApiSelection } from '@stacksjs/types'
import { readdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

export interface ModelRegistryOptions {
  userRoot: string
  defaultsRoot: string
  onImportError?: (file: string, error: unknown) => void
}

export function modelFiles(root: string): string[] {
  const files: string[] = []

  const walk = (directory: string): void => {
    let entries: Dirent[]
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    }
    catch {
      return
    }

    for (const entry of entries) {
      const file = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(file)
        continue
      }
      if (!['.ts', '.js'].includes(extname(entry.name)))
        continue
      if (entry.name.startsWith('.') || entry.name.startsWith('index'))
        continue
      files.push(file)
    }
  }

  walk(root)
  return files.sort()
}

/**
 * Where a registered model came from. An app model that overrides a framework
 * default by name is the app's: it replaced the default, so the app wrote it.
 */
export type ModelOrigin = 'app' | 'default'

export interface LoadedModelRegistry {
  models: Record<string, any>
  origins: Record<string, ModelOrigin>
}

async function loadRoot(
  root: string,
  origin: ModelOrigin,
  registry: LoadedModelRegistry,
  onImportError?: ModelRegistryOptions['onImportError'],
): Promise<void> {
  for (const file of modelFiles(root)) {
    try {
      const extension = extname(file)
      const module = await import(`${file}?t=${Date.now()}`)
      const definition = module.default ?? module
      const name = definition.name ?? basename(file, extension)
      registry.models[name] = { ...definition, name }
      registry.origins[name] = origin
    }
    catch (error) {
      onImportError?.(file, error)
    }
  }
}

/** {@link loadModelRegistry}, plus which root each model was loaded from. */
export async function loadModelRegistryWithOrigins(options: ModelRegistryOptions): Promise<LoadedModelRegistry> {
  const registry: LoadedModelRegistry = { models: {}, origins: {} }

  await loadRoot(options.defaultsRoot, 'default', registry, options.onImportError)
  await loadRoot(options.userRoot, 'app', registry, options.onImportError)

  return registry
}

export async function loadModelRegistry(options: ModelRegistryOptions): Promise<Record<string, any>> {
  return (await loadModelRegistryWithOrigins(options)).models
}

/**
 * Which models publish the REST API their `useApi` trait describes
 * ({@link ModelApiSelection}).
 *
 * Every `useApi` model used to, the framework's ~80 defaults included, and an
 * app had no way to say otherwise. A forge whose central object is a code
 * review served the framework's product reviews at `/api/reviews`, and
 * `/api/comments`, `/api/labels` and `/api/tags` beside it - over tables it
 * never migrated, so they were discoverable, in the OpenAPI document, and
 * failed at runtime rather than 404ing (stacksjs/stacks#2866).
 *
 * - `'all'` - every `useApi` model, app and framework. The default, so an app
 *   that says nothing keeps the surface it had.
 * - `'own'` - only the app's own models (`app/Models`, overrides included).
 * - `'none'` - no generated model APIs at all.
 * - a list of model names - exactly those. `'own'` may appear in it to mean
 *   "mine, plus these defaults".
 *
 * A model listed here still needs its own `useApi` trait: this narrows the
 * set, it never adds an API to a model that did not ask for one.
 */
export type { ModelApiSelection }

export interface ResolvedModelApiSelection {
  /** Every `useApi` model. */
  all: boolean
  /** The app's own models. */
  own: boolean
  /** Models named one by one, lowercased. */
  names: Set<string>
  /** Where the selection came from, for the boot message. */
  source: 'env' | 'config' | 'default'
}

/**
 * Read the selection from `security.api.models`, with `STACKS_MODEL_APIS`
 * overriding it - the same config-then-env pairing as `api.rowScoping` and
 * `STACKS_API_ROW_SCOPING`.
 *
 * The env var takes a comma-separated list in the spellings
 * `STACKS_DEFAULT_ROUTES` uses: `none` (or empty) for nothing, `all` for
 * everything, otherwise names. `none` beats `all`, which beats a list, so a
 * value can never mean something wider than its most restrictive keyword.
 *
 * Anything that is not a string or an array of strings - a typo'd type in
 * the config - is treated as unset, which is `all`: the setting narrows a
 * surface, and an unreadable one should leave the surface as it was rather
 * than silently take an app's API down.
 */
export function resolveModelApiSelection(configured: unknown, envOverride?: string | null): ResolvedModelApiSelection {
  let raw: readonly string[] | undefined
  let source: ResolvedModelApiSelection['source'] = 'default'

  if (envOverride !== undefined && envOverride !== null) {
    raw = envOverride.split(',')
    source = 'env'
  }
  else if (typeof configured === 'string') {
    raw = [configured]
    source = 'config'
  }
  else if (Array.isArray(configured) && configured.every(entry => typeof entry === 'string')) {
    raw = configured
    source = 'config'
  }

  if (raw === undefined)
    return { all: true, own: false, names: new Set(), source }

  const names = raw.map(name => name.trim().toLowerCase()).filter(Boolean)

  if (names.length === 0 || names.includes('none'))
    return { all: false, own: false, names: new Set(), source }
  if (names.includes('all'))
    return { all: true, own: false, names: new Set(), source }

  return {
    all: false,
    own: names.includes('own'),
    names: new Set(names.filter(name => name !== 'own')),
    source,
  }
}

/**
 * The `useApi` models a selection publishes, and the names in it that match
 * no `useApi` model.
 *
 * Names match case-insensitively against the model name (`Product`), so
 * `STACKS_MODEL_APIS=product` works. An unmatched name is reported rather than
 * fatal - a typo costs the one API, not the boot - and that includes naming a
 * model that exists but has no `useApi` trait, since the selection cannot
 * give it one.
 */
export function selectApiModels(
  registry: LoadedModelRegistry,
  selection: ResolvedModelApiSelection,
): { models: Record<string, any>, unmatched: string[] } {
  const selected: Record<string, any> = {}
  const matched = new Set<string>()

  for (const [name, model] of Object.entries(registry.models)) {
    if (!model?.traits?.useApi)
      continue

    const key = name.toLowerCase()
    const named = selection.names.has(key)
    if (named)
      matched.add(key)

    if (selection.all || named || (selection.own && registry.origins[name] === 'app'))
      selected[name] = model
  }

  return {
    models: selected,
    unmatched: [...selection.names].filter(name => !matched.has(name)).sort(),
  }
}
