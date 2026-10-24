import { overridesReady } from '@stacksjs/config'
import { resolveModelSources } from '@stacksjs/database/model-sources'

/** Search the same application model scope that owns the database schema. */
export async function searchModelFiles(): Promise<string[]> {
  await overridesReady
  return (resolveModelSources()?.models ?? []).map(model => model.file)
}
