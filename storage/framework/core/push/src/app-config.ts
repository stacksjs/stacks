import type { ServicesConfig } from '@stacksjs/types'

/**
 * The application's `config/services.ts`, read when a push is sent.
 *
 * Read lazily and after `awaitConfig()`, never at module load: until the
 * app's own config files have loaded, `config.services` holds the framework
 * defaults, so a value captured on import would be the empty string the
 * defaults carry rather than the credential the app set (stacksjs/stacks#2857).
 *
 * Imported dynamically so a script that only builds payloads, and the tests
 * that exercise them, do not pull the whole config graph in.
 */
export async function appServices(): Promise<ServicesConfig> {
  const { awaitConfig } = await import('@stacksjs/config')
  return (await awaitConfig()).services ?? {}
}

/**
 * A credential as it arrives from config: blank means unset.
 *
 * `config/services.ts` writes `String(env.X || '')`, so a missing variable is
 * an empty string, not `undefined`, and has to lose to an explicit value
 * rather than overwrite it.
 */
export function present(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
