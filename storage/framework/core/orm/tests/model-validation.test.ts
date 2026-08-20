/**
 * stacksjs/stacks#2233 — declared `validation.rule`s ran on the generated REST
 * routes and nowhere else. `Model.create()` / `.update()` went through
 * mass-assignment filtering and casts but never touched the rules, so the same
 * model got no width, type or enum enforcement when written from code rather
 * than over HTTP, and the database was the first thing to notice. On Postgres
 * an over-length varchar insert is a hard 22001, which surfaces as a 500 on
 * whichever endpoint performed the write.
 *
 * These cover the enforcement wrapper directly against a stub model, so no
 * database or live ORM boot is involved.
 */

import { describe, expect, it } from 'bun:test'
import { schema } from '@stacksjs/validation'
import { validateWriteBody } from '../src/auto-crud'
import { defineModel } from '../src/define-model'

const model = {
  name: 'PageView',
  attributes: {
    path: { fillable: true, validation: { rule: schema.string().max(255) } },
    country: { fillable: true, validation: { rule: schema.string().max(2) } },
    title: { fillable: true, validation: { rule: schema.string().max(255) } },
  },
}

describe('validateWriteBody on the direct write path (#2233)', () => {
  it('rejects a value wider than the declared column', () => {
    // The exact failure from the report: an over-length path reaching the
    // page_views insert, where Postgres answers 22001 and the beacon 500s.
    const result = validateWriteBody({ path: 'x'.repeat(256) }, model, 'creating')

    expect(result.valid).toBe(false)
    if (!result.valid)
      expect(Object.keys(result.errors)).toContain('path')
  })

  it('accepts a value at exactly the declared width', () => {
    expect(validateWriteBody({ path: 'x'.repeat(255) }, model, 'creating').valid).toBe(true)
  })

  it('checks every declared attribute, not just the first', () => {
    const result = validateWriteBody({ path: 'ok', country: 'TOO_LONG' }, model, 'creating')

    expect(result.valid).toBe(false)
    if (!result.valid)
      expect(Object.keys(result.errors)).toEqual(['country'])
  })

  describe('partial-update semantics', () => {
    it('skips fields the caller did not send on update', () => {
      // A partial update must not trip a rule on an untouched sibling —
      // otherwise every `.update()` would have to resend the whole row.
      expect(validateWriteBody({ path: 'ok' }, model, 'updating').valid).toBe(true)
    })

    it('still checks the fields the caller DID send on update', () => {
      expect(validateWriteBody({ country: 'TOO_LONG' }, model, 'updating').valid).toBe(false)
    })

    it('does not skip absent fields on create', () => {
      // `creating` evaluates absent fields as missing values, which is how a
      // `required` rule can fire at all.
      const required = {
        name: 'Site',
        attributes: { domain: { fillable: true, validation: { rule: schema.string().required() } } },
      }
      expect(validateWriteBody({}, required, 'updating').valid).toBe(true)
      expect(validateWriteBody({}, required, 'creating').valid).toBe(false)
    })
  })

  it('is a no-op for a model that declares no rules', () => {
    expect(validateWriteBody({ anything: 1 }, { name: 'Bare', attributes: { a: { fillable: true } } }, 'creating').valid)
      .toBe(true)
    expect(validateWriteBody({ x: 1 }, { name: 'Empty' }, 'creating').valid).toBe(true)
  })
})

describe('ModelValidationError shape', () => {
  it('carries a 422 and a per-field errors map', async () => {
    // Duck-typed by `mapWriteError`, which preserves any integer `status` in
    // 400-599 — so this surfaces as a 422 rather than the driver error's 500.
    const { ModelValidationError } = await import('../src/define-model')
    const err = new ModelValidationError('PageView', { path: ['too long'] })

    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(422)
    expect(err.errors).toEqual({ path: ['too long'] })
    expect(err.message).toContain('PageView')
    expect(err.message).toContain('path')
  })

  it('maps to a 422 through the auto-CRUD write-error mapper', async () => {
    const { mapWriteError } = await import('../src/auto-crud')
    const { ModelValidationError } = await import('../src/define-model')

    const mapped = mapWriteError(new ModelValidationError('PageView', { path: ['too long'] }), 'PageView', 'create')

    expect(mapped.status).toBe(422)
  })
})

describe('a real defineModel enforces its rules on create/update', () => {
  // The assertion that actually matters: the helper above being correct means
  // nothing unless `defineModel`'s wrapper chain calls it. No database is
  // touched — validation runs before any driver call, which is the point.
  const Probe: any = defineModel({
    name: 'ProbeView',
    table: 'probe_views',
    attributes: {
      path: { fillable: true, validation: { rule: schema.string().max(10) } },
    },
  } as any)

  it('create() throws a 422-shaped ModelValidationError instead of reaching the driver', async () => {
    const err = await Probe.create({ path: 'x'.repeat(50) }).then(() => null, (e: any) => e)

    expect(err).not.toBeNull()
    expect(err.name).toBe('ModelValidationError')
    expect(err.status).toBe(422)
    expect(Object.keys(err.errors)).toEqual(['path'])
  })

  it('update() throws for a field the caller did send', async () => {
    const err = await Probe.update(1, { path: 'x'.repeat(50) }).then(() => null, (e: any) => e)

    expect(err).not.toBeNull()
    expect(err.name).toBe('ModelValidationError')
  })

  it('exposes withoutValidation on the model', () => {
    expect(typeof Probe.withoutValidation).toBe('function')
  })

  it('withoutValidation actually lets the over-length write through', async () => {
    // Proves the wrapper consults the suppression scope, not merely that the
    // scope exists. It gets past validation and then fails at the driver (no
    // table here) — a DIFFERENT error, which is exactly the evidence wanted.
    const err = await Probe.withoutValidation(() => Probe.create({ path: 'x'.repeat(50) }))
      .then(() => null, (e: any) => e)

    expect(err?.name).not.toBe('ModelValidationError')
  })

  it('createQuietly is validated too - quiet means no events, not no rules', async () => {
    // The `*Quietly` helpers capture whichever `create` exists when they are
    // installed, so this fails if the validation wrapper is applied after them.
    const err = await Probe.createQuietly({ path: 'x'.repeat(50) }).then(() => null, (e: any) => e)

    expect(err).not.toBeNull()
    expect(err.name).toBe('ModelValidationError')
  })
})

describe('withoutValidation escape hatch', () => {
  it('suppresses rules for the duration of the callback, then restores', async () => {
    const { withoutValidation } = await import('../src/define-model')
    const seen: boolean[] = []

    // The scope is AsyncLocalStorage-backed, so nested awaits inherit it and
    // the surrounding code is unaffected once it returns.
    await withoutValidation(async () => {
      await Promise.resolve()
      seen.push(true)
    })

    expect(seen).toEqual([true])
    // Rules still evaluate normally outside the scope.
    expect(validateWriteBody({ path: 'x'.repeat(256) }, model, 'creating').valid).toBe(false)
  })

  it('returns the callback result', async () => {
    const { withoutValidation } = await import('../src/define-model')
    expect(await withoutValidation(async () => 'done')).toBe('done')
  })
})

/**
 * A declared `default` must satisfy a declared `required`.
 *
 * `validateWriteBody` treated an absent field as `undefined` on create, so
 * `required()` failed even when the attribute declared a `default` that the
 * write would have filled in. Enforcement runs as the outermost wrapper —
 * deliberately, because the rules are written against pre-cast input — which
 * puts it ahead of every step that supplies defaults, so the default never got
 * a chance to exist.
 *
 * The effect is that `required().default(x)` is not a defaulted field at all:
 * it is a mandatory one whose default is dead code, and every caller has to
 * pass a value the model already said it knew. The framework's own commerce
 * `Product` declares `preparationTime` exactly that way, so any app writing a
 * product from code — an importer, a seeder, a migration — got
 * `Product validation failed: preparationTime` for a field it had no opinion
 * about.
 */
const defaulted = {
  name: 'Product',
  attributes: {
    name: { fillable: true, validation: { rule: schema.string().required() } },
    preparationTime: { fillable: true, default: 15, validation: { rule: schema.number().required().min(1) } },
    servings: { fillable: true, default: 0, validation: { rule: schema.number().min(0) } },
  },
}

describe('defaults and required', () => {
  it('accepts a create that omits a required field carrying a default', () => {
    expect(validateWriteBody({ name: 'Strawnana' }, defaulted, 'creating').valid).toBe(true)
  })

  it('still rejects a required field with no default', () => {
    const result = validateWriteBody({ preparationTime: 20 }, defaulted, 'creating')

    expect(result.valid).toBe(false)
    if (!result.valid)
      expect(Object.keys(result.errors)).toEqual(['name'])
  })

  it('validates the default itself, so a default that breaks its own rule is caught', () => {
    // Worth failing loudly: nothing else ever looks at this value, and a
    // default below the rule's own minimum writes an invalid row on every
    // create that omits the field.
    const bad = {
      name: 'Product',
      attributes: {
        preparationTime: { fillable: true, default: 0, validation: { rule: schema.number().required().min(1) } },
      },
    }

    expect(validateWriteBody({}, bad, 'creating').valid).toBe(false)
  })

  it('does not treat a falsy default as absent', () => {
    // `default: 0` is a value. An `attribute.default ?? undefined` style check
    // would drop it and re-introduce the bug for exactly the fields most likely
    // to have one.
    expect(validateWriteBody({ name: 'x' }, defaulted, 'creating').valid).toBe(true)
  })

  it('leaves the update path alone', () => {
    expect(validateWriteBody({ name: 'x' }, defaulted, 'updating').valid).toBe(true)
  })
})
