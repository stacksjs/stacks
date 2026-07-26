/**
 * The project-generated attribute union.
 *
 * `buddy generate:types` writes `storage/framework/types/attributes.ts`, one
 * union of every model's fillable columns. It is re-exported under its own
 * name rather than as `Attributes`, because that name has to resolve in an
 * app installed from npm too, where this generated file is not part of the
 * shipped package — there, `Attributes` comes from `./model` and is the loose
 * record that model setters actually treat it as.
 *
 * Type-only so Bun's runtime resolver never tries to load the file.
 */
export type * as GeneratedAttributes from '../../../types/attributes'
