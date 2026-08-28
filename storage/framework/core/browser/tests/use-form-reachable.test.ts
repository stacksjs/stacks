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

  it('is declared in the browser auto-import surface', () => {
    // Without this an editor never offers it, which is the entire failure
    // mode — the primitive existed and worked the whole time.
    expect(readFileSync(AUTO_IMPORTS, 'utf8')).toContain("const useForm:")
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

  it('and is declared', () => {
    const declared = readFileSync(AUTO_IMPORTS, 'utf8')
    const undeclared = OWNED.filter(name => !declared.includes(`const ${name}:`))
    expect(undeclared).toEqual([])
  })
})
