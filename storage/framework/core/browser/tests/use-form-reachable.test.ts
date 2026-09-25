// `useForm` is reachable from a client script (stacksjs/stx#1843).
//
// It shipped with per-field validation, `inputProps()` carrying aria-invalid /
// aria-describedby, isSubmitting, touched/dirty and setErrors for 422 mapping —
// and appeared in NEITHER auto-import surface, so there was no way to find it
// without already knowing the package path. Two production apps hand-rolled N
// signals plus manual error flags and manual focus per form instead. The audit
// in stx#1843 measured 0 hits for `useForm` against a control that hit, which
// is how the gap was found.
//
// Reachability has two halves and both are checked, because they fail
// independently: the module has to actually re-export it (runtime), and the
// generated declaration has to name it (editor autocomplete, which is how
// anyone discovers it in the first place).

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const AUTO_IMPORTS = join(import.meta.dir, '../../../types/browser-auto-imports.d.ts')

describe('useForm is reachable (stx#1843)', () => {
  it('is re-exported by the browser surface at runtime', async () => {
    const vendors = await import('../src/utils/vendors')
    expect(typeof (vendors as Record<string, unknown>).useForm).toBe('function')
  })

  it('is offered by the module an editor completes against', () => {
    // This asserted `const useForm:` in `browser-auto-imports.d.ts` until
    // stacksjs/stacks#2585. That declaration made the name resolve for `tsc`
    // and NOT in the browser: the stx runtime never attached it to `window`, so
    // a bare `useForm()` in a template typechecked and then raised a
    // ReferenceError during setup, taking the whole root down unhydrated. The
    // two names beside it in `OWNED` were doing exactly that in five shipped
    // components.
    //
    // Discovery is the real goal and an import serves it: the editor completes
    // the name once the module is imported, and the call then works. So what is
    // pinned is that the documented path exports it.
    const vendors = readFileSync(join(import.meta.dir, '../src/utils/vendors.ts'), 'utf8')
    expect(vendors).toContain('useForm')
    expect(vendors).toContain(`from '@stacksjs/composables'`)
  })

  it('the composable behind it is the reactive one, not a schema builder', () => {
    // stx also ships `defineForm`, which is a validation SCHEMA library whose
    // state is plain objects — `form.errors.email` in a template never
    // re-renders. The two names are confusingly close and only this one can
    // drive a template, so pin which one landed here.
    const source = readFileSync(join(import.meta.dir, '../../composables/src/useForm.ts'), 'utf8')
    expect(source).toContain('import { ref }')
    expect(source).toContain('export function useForm')
  })
})

describe('a declared browser global is actually exported (stx#1843)', () => {
  // These are the ones this change is responsible for. The whole set is
  // asserted elsewhere now: the declaration named 243 symbols from this module
  // against 15 exports, and `name-registries.test.ts` in @stacksjs/server
  // fails if a name that resolves to nothing is declared again.
  const OWNED = ['useForm', 'useScrollLock', 'useTimeoutFn']

  it('every name this change touched resolves', async () => {
    const vendors = await import('../src/utils/vendors') as Record<string, unknown>
    const missing = OWNED.filter(name => typeof vendors[name] !== 'function')
    expect(missing).toEqual([])
  })

  it('and is not declared as an ambient global, because none of them is one', () => {
    // The inverse of what this asserted before stacksjs/stacks#2585, and for a
    // reason measured rather than argued: against the runtime stx serves, the
    // declaration named 83 globals, 61 were attached to `window`, and three
    // were in both. None of these three is. Re-declaring one would restore a
    // name that compiles and then throws.
    const declared = readFileSync(AUTO_IMPORTS, 'utf8')
    const wronglyDeclared = OWNED.filter(name => declared.includes(`const ${name}:`))
    expect(wronglyDeclared).toEqual([])
  })
})
