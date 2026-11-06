import { overridesReady } from '@stacksjs/config'
import { injectGlobalAutoImports } from '@stacksjs/server'

/** Model projections have the same framework globals in CLI and API processes. */
export async function prepareSearchModels(): Promise<void> {
  await overridesReady
  await injectGlobalAutoImports()
}
