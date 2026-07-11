/**
 * Browser Model Loader
 *
 * Dynamically imports all model definitions from app/Models/ and creates
 * browser-compatible models that use fetch() for API calls.
 *
 * This eliminates the need for code generation - models are loaded at runtime.
 */

import { createBrowserModel } from 'bun-query-builder/browser'

/**
 * Minimal shape of a model attribute as far as the browser model
 * loader is concerned. The full server-side attribute has
 * `factory`, validation rules, casters, etc. — none of which are
 * meaningful client-side, so we strip them off in
 * {@link extractBrowserAttributes}.
 */
export interface BrowserAttributeDefinition {
  fillable?: boolean
  hidden?: boolean
  guarded?: boolean
  nullable?: boolean
}

/**
 * `useApi` trait shape — declares the REST URI the browser model
 * should call into. When omitted, the loader skips the model
 * (browser code can't reach a model that has no API surface).
 */
export interface BrowserUseApiTrait {
  uri: string
  [extra: string]: unknown
}

/**
 * Subset of model-traits the browser loader inspects. Server-side
 * traits like `useAudit`, `observe`, etc. aren't meaningful client-
 * side — only the four below influence browser-side behaviour.
 */
export interface BrowserModelTraits {
  useApi?: BrowserUseApiTrait
  useUuid?: boolean
  useTimestamps?: boolean
  useSoftDeletes?: boolean
  [extra: string]: unknown
}

/**
 * Shape of a `defineModel(...)`-returned module's default export
 * that the browser loader cares about. Mirrors a tight subset of
 * `StacksModelDefinition` from `@stacksjs/orm` — typed locally so
 * the browser package doesn't pull the full ORM types in.
 */
export interface BrowserModelDefinition {
  name: string
  table?: string
  primaryKey?: string
  traits?: BrowserModelTraits
  attributes?: Record<string, BrowserAttributeDefinition & { [extra: string]: unknown }>
  [extra: string]: unknown
}

/**
 * Shape of a model returned by `createBrowserModel`. Methods are
 * declared loosely (the underlying bun-query-builder API surface
 * is broader and changes) — we only check `.all` / `.find` exist
 * in {@link getBrowserModelNames} for discovery.
 */
export interface BrowserModel {
  all: (...args: unknown[]) => unknown
  find: (id: string | number, ...args: unknown[]) => unknown
  [extra: string]: unknown
}

/**
 * Window augmentation for the framework's `StacksBrowser` global
 * (stacksjs/stacks#1894 T-9). Pre-fix every access went through
 * `(window as any)` — typos in model names silently returned
 * `undefined`. The augmented index signature still permits any
 * model name at runtime; what it adds is the existence + shape of
 * the StacksBrowser bag itself.
 */
declare global {
  interface Window {
    StacksBrowser?: Record<string, BrowserModel | undefined>
  }
}

// Dynamically import all model definitions from app/Models/
// Uses import.meta.glob in Vite context (build time), or empty map in Bun/Node context
const modelModules: Record<string, { default: BrowserModelDefinition }> = typeof (import.meta as { glob?: unknown }).glob === 'function'
  ? (import.meta as unknown as { glob: (pattern: string, opts?: { eager?: boolean }) => Record<string, { default: BrowserModelDefinition }> }).glob('~/app/Models/*.ts', { eager: true })
  : {}

/**
 * Load all models and register them on window.StacksBrowser
 */
export function loadBrowserModels(): void {
  if (typeof window === 'undefined') return

  // Ensure StacksBrowser exists
  if (!window.StacksBrowser) {
    window.StacksBrowser = {}
  }

  for (const [path, module] of Object.entries(modelModules)) {
    const definition = module.default

    // Skip if no default export or no name
    if (!definition || !definition.name) {
      console.warn(`[model-loader] Skipping ${path}: no valid model definition`)
      continue
    }

    // Skip if no useApi trait (model doesn't have API routes)
    if (!definition.traits?.useApi?.uri) {
      continue
    }

    try {
      // Create browser model from definition
      const browserModel = createBrowserModel({
        name: definition.name,
        table: definition.table ?? definition.name.toLowerCase(),
        primaryKey: definition.primaryKey || 'id',
        traits: {
          useUuid: definition.traits?.useUuid ?? false,
          useTimestamps: definition.traits?.useTimestamps ?? true,
          useSoftDeletes: definition.traits?.useSoftDeletes ?? false,
          useApi: definition.traits?.useApi,
        },
        attributes: extractBrowserAttributes(definition.attributes ?? {}),
      } as const)

      // Register on StacksBrowser
      window.StacksBrowser[definition.name] = browserModel as unknown as BrowserModel
    }
    catch (error) {
      console.error(`[model-loader] Failed to create browser model for ${definition.name}:`, error)
    }
  }
}

/**
 * Extract browser-relevant attributes from full model definition.
 * Strips out server-only properties like validation rules and factories.
 */
function extractBrowserAttributes(
  attributes: Record<string, BrowserAttributeDefinition & { [extra: string]: unknown }>,
): Record<string, BrowserAttributeDefinition> {
  const browserAttrs: Record<string, BrowserAttributeDefinition> = {}

  for (const [name, attr] of Object.entries(attributes)) {
    browserAttrs[name] = {
      fillable: attr.fillable ?? false,
      hidden: attr.hidden ?? false,
      guarded: attr.guarded ?? false,
      nullable: attr.nullable ?? false,
    }
  }

  return browserAttrs
}

/**
 * Get a loaded model by name
 */
export function getBrowserModel(name: string): BrowserModel | null {
  if (typeof window === 'undefined') return null
  return window.StacksBrowser?.[name] ?? null
}

/**
 * Get all loaded model names
 */
export function getBrowserModelNames(): string[] {
  if (typeof window === 'undefined') return []

  const stacksBrowser = window.StacksBrowser
  if (!stacksBrowser) return []

  return Object.keys(stacksBrowser).filter((key) => {
    const value = stacksBrowser[key]
    return value != null && typeof value.all === 'function' && typeof value.find === 'function'
  })
}
