/**
 * The declarations for a project's environment variables.
 *
 * Three separate faults met here, and each one on its own was invisible:
 *
 *   1. Nothing called the generator. `env-files.ts` was a top-level script
 *      with no importer anywhere in the repo, so the declarations it owns were
 *      whatever the last person to run it by hand had produced.
 *   2. It seeded its key list from `storage/framework/env.ts` — the file it
 *      writes at the end, from that same list. The set could only ever stay
 *      the same size, so a variable added to `.env` was never declared.
 *   3. It only augmented Bun's `env` namespace, while `config/` reads the
 *      `env` exported by '@stacksjs/env', whose catch-all index signature
 *      types an unlisted variable `string | number | boolean | undefined`.
 *
 * Together: erbamarkets had 29 of 58 variables undeclared, and reading one in
 * `config/` failed against a plain `string` field with a type that names no
 * variable and points at no cause.
 */

import { describe, expect, it } from 'bun:test'
import { renderEnvTypes } from '../src/generate/env-files'

const typeOf = (key: string): string => (key.endsWith('_PORT') ? 'number' : 'string')

const render = (keys: string[], declared: string[] = []): string =>
  renderEnvTypes(keys, new Set(declared), typeOf)

describe('generated env declarations', () => {
  it('is a module, so the blocks augment rather than shadow', () => {
    /*
     * Without this, `declare module '@stacksjs/env'` is an ambient module
     * declaration that replaces the real one, and the package appears to
     * export only the members named here — every `import { env }` in config/
     * fails with "has no exported member 'env'".
     */
    expect(render(['TYPESENSE_HOST'])).toContain('export {}')
  })

  it('declares a variable on both the Bun namespace and StacksEnv', () => {
    const dts = render(['TYPESENSE_HOST'])

    expect(dts).toContain('const TYPESENSE_HOST: string')
    expect(dts).toContain('TYPESENSE_HOST: string | undefined')
  })

  it('gives a numeric variable a numeric type', () => {
    expect(render(['TYPESENSE_PORT'])).toContain('const TYPESENSE_PORT: number')
  })

  it('does not restate a property the framework interface already declares', () => {
    /*
     * A merged interface must repeat a property's type exactly. `APP_NAME` is
     * `string | undefined` in StacksEnv and would be `string` here, so
     * restating it makes the whole declaration file an error.
     */
    const dts = render(['APP_NAME', 'TYPESENSE_HOST'], ['APP_NAME'])
    const augmentation = dts.slice(dts.indexOf("declare module '@stacksjs/env'"))

    expect(augmentation).not.toContain('APP_NAME')
    expect(augmentation).toContain('TYPESENSE_HOST')

    // Still declared for Bun, which is a namespace of consts, not a merge.
    expect(dts).toContain('const APP_NAME: string')
  })

  it('emits both augmentations even with nothing left to add to StacksEnv', () => {
    const dts = render(['APP_NAME'], ['APP_NAME'])

    expect(dts).toContain(`declare module 'bun'`)
    expect(dts).toContain(`declare module '@stacksjs/env'`)
  })
})
