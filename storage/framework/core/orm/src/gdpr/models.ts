import { path } from '@stacksjs/path'
import { loadModelRegistry } from '../model-registry'

/**
 * The model definitions GDPR requests run against: the framework defaults,
 * with the app's own `app/Models` overriding them by name - the same merge the
 * generated API routes and the OpenAPI spec read.
 *
 * A default whose table this app never migrated is still in the set; the
 * engine reports it as skipped rather than querying a table that is not there.
 */
export async function loadGdprModels(): Promise<Record<string, any>> {
  return loadModelRegistry({
    defaultsRoot: path.frameworkPath('defaults/app/Models'),
    userRoot: path.userModelsPath(),
  })
}
