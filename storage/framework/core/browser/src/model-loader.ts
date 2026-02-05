/**
 * Browser Model Loader
 *
 * Dynamically imports all model definitions from app/Models/ and creates
 * browser-compatible models that use fetch() for API calls.
 *
 * This eliminates the need for code generation - models are loaded at runtime.
 */

import { createBrowserModel } from 'bun-query-builder'

// Use Vite's import.meta.glob to dynamically import all model files
// This is processed at build time and creates a map of all model modules
const modelModules = import.meta.glob<{ default: any }>('~/app/Models/*.ts', { eager: true })

/**
 * Load all models and register them on window.StacksBrowser
 */
export function loadBrowserModels(): void {
  if (typeof window === 'undefined') return

  // Ensure StacksBrowser exists
  if (!(window as any).StacksBrowser) {
    ;(window as any).StacksBrowser = {}
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
        table: definition.table,
        primaryKey: definition.primaryKey || 'id',
        traits: {
          useUuid: definition.traits?.useUuid ?? false,
          useTimestamps: definition.traits?.useTimestamps ?? true,
          useSoftDeletes: definition.traits?.useSoftDeletes ?? false,
          useApi: definition.traits?.useApi,
        },
        attributes: extractBrowserAttributes(definition.attributes || {}),
      } as const)

      // Register on StacksBrowser
      ;(window as any).StacksBrowser[definition.name] = browserModel
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
function extractBrowserAttributes(attributes: Record<string, any>): Record<string, any> {
  const browserAttrs: Record<string, any> = {}

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
export function getBrowserModel(name: string): any {
  if (typeof window === 'undefined') return null
  return (window as any).StacksBrowser?.[name] ?? null
}

/**
 * Get all loaded model names
 */
export function getBrowserModelNames(): string[] {
  if (typeof window === 'undefined') return []

  const stacksBrowser = (window as any).StacksBrowser
  if (!stacksBrowser) return []

  return Object.keys(stacksBrowser).filter(key => {
    const value = stacksBrowser[key]
    return value && typeof value.all === 'function' && typeof value.find === 'function'
  })
}
