import type { ValidationInstance } from '@stacksjs/ts-validation'
import { v } from '@stacksjs/ts-validation'
import { file, FileValidator } from './file-validator'

/**
 * Extended `ValidationInstance` that adds `schema.file()` on top of the
 * ts-validation surface (stacksjs/stacks#1856). Upstream ts-validation
 * has `string()`, `number()`, `enum()`, etc. but no `file()` validator;
 * we layer one here without forking ts-validation so the rest of the
 * surface keeps working unchanged.
 *
 * The runtime value is the ts-validation proxy with `file` patched in.
 * Consumers importing `schema` see everything ts-validation gives them
 * plus `.file()` returning a chainable {@link FileValidator}.
 */
export interface SchemaWithFile extends ValidationInstance {
  file: () => FileValidator
}

/**
 * `Object.assign({}, v, { file })` would defeat the ts-validation
 * proxy's late-binding. Wrapping with `new Proxy` keeps every existing
 * `schema.<method>()` call going through the upstream proxy while only
 * intercepting `file` — that way Proxy invariants stay intact and
 * forwarding cost is one identity check per lookup.
 */
export const schema: SchemaWithFile = new Proxy(v as unknown as SchemaWithFile, {
  get(target, prop, receiver) {
    if (prop === 'file') return file
    return Reflect.get(target, prop, receiver)
  },
})

export { file, FileValidator } from './file-validator'
export type { FileLike } from './file-validator'
