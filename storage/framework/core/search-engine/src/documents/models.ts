import { feature, overridesReady } from '@stacksjs/config'
import { resolveModelSources } from '@stacksjs/database/model-sources'
import { frameworkModelFeature, getModelName } from '@stacksjs/orm'
import type { Model } from '@stacksjs/types'

/** Search the same application model scope that owns the database schema. */
export async function searchModelFiles(): Promise<string[]> {
  await overridesReady
  return (resolveModelSources()?.models ?? []).map(model => model.file)
}

/** Resolve and validate an optional selector before any provider mutation. */
export async function selectedSearchModels(modelOption?: string): Promise<Array<{ file: string, model: Model }>> {
  if (modelOption !== undefined && typeof modelOption !== 'string')
    throw new TypeError('A search model selector must be a model name.')
  const selected: Array<{ file: string, model: Model }> = []
  for (const file of await searchModelFiles()) {
    const model = (await import(file)).default as Model
    const name = getModelName(model, file)
    if (modelOption && name !== modelOption) continue
    const gate = frameworkModelFeature(name)
    if (gate && !feature(gate)) {
      if (modelOption) throw new Error(`Search model ${name} is unavailable because ${gate} is disabled.`)
      continue
    }
    if (!model.traits?.useSearch) {
      if (modelOption) throw new Error(`Model ${modelOption} does not enable useSearch.`)
      continue
    }
    selected.push({ file, model })
  }
  if (modelOption && selected.length === 0)
    throw new Error(`Search model ${modelOption} was not found in the application's model scope.`)
  return selected
}
