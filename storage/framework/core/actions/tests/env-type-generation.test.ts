/**
 * The declarations for a project's environment variables.
 *
 * This generator now owns exactly one surface: Bun's `env` namespace, typed
 * from the project's `.env` files. It used to also augment `StacksEnv` - the
 * type behind the `env` that `config/` reads - and that was the wrong source
 * for it twice over:
 *
 *   1. The key set was scraped from whichever `.env` was on the machine
 *      running the generator, so a variable set only in deploy secrets could
 *      never be typed. loghq had 14 in that state.
 *   2. Each type was read off the variable's live value, so the same variable
 *      could be `number` on one checkout and `string` on another, and the
 *      output was gitignored, so it did not survive a clone.
 *
 * `StacksEnv` is extended from `config/env.ts` instead, which declares those
 * variables anyway and is committed - see `InferEnv` in '@stacksjs/env'.
 */

import { describe, expect, it } from 'bun:test'
import { renderEnvTypes } from '../src/generate/env-files'

const typeOf = (key: string): string => (key.endsWith('_PORT') ? 'number' : 'string')

const render = (keys: string[]): string => renderEnvTypes(keys, typeOf)

describe('generated env declarations', () => {
  it('is a module, so the block augments rather than shadows', () => {
    /*
     * Without this, `declare module 'bun'` is an ambient module declaration
     * that replaces the real one, and the package appears to export only the
     * members named here.
     */
    expect(render(['TYPESENSE_HOST'])).toContain('export {}')
  })

  it('declares a variable on the Bun namespace', () => {
    expect(render(['TYPESENSE_HOST'])).toContain('const TYPESENSE_HOST: string')
  })

  it('gives a numeric variable a numeric type', () => {
    expect(render(['TYPESENSE_PORT'])).toContain('const TYPESENSE_PORT: number')
  })

  it('no longer augments StacksEnv', () => {
    /*
     * Two declarations of one variable is how this breaks: `config/env.ts`
     * types STRIPE_WEBHOOK_SECRET as `string` from its validator while this
     * file would type it from whatever the local `.env` holds, and a merged
     * interface whose property types disagree fails to compile.
     */
    // Comment lines dropped: the header shows the config/env.ts migration,
    // which names '@stacksjs/env' without declaring anything.
    const code = render(['APP_NAME', 'TYPESENSE_HOST'])
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n')

    expect(code).toContain(`declare module 'bun'`)
    expect(code).not.toContain(`declare module '@stacksjs/env'`)
    expect(code).not.toContain('interface StacksEnv')
  })

  it('points at config/env.ts for the variables it does not type', () => {
    // The migration has to be findable from the file someone is staring at.
    expect(render(['TYPESENSE_HOST'])).toContain('config/env.ts')
  })
})
