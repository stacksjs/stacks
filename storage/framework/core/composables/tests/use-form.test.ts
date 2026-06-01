import { describe, expect, test } from 'bun:test'
import type { FormValidator } from '../src/useForm'
import { useForm } from '../src/useForm'

/**
 * Tests for useForm (stacksjs/stacks#1940 Phase 1).
 *
 * The composable depends on a minimal Validator surface (`.validate()`
 * returning `{ valid, errors }`) so we use lightweight stubs here
 * instead of pulling in `@stacksjs/validation` — the integration is
 * covered in the validation package's own test suite. Phase 1 ships
 * the primitive only; companion components + field arrays + 422
 * auto-surfacing are scoped to later phases.
 */

function tick(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const emailRule: FormValidator = {
  validate(value: unknown) {
    if (typeof value !== 'string' || !value.includes('@')) {
      return { valid: false, errors: [{ message: 'Invalid email' }] }
    }
    return { valid: true, errors: [] }
  },
}

const minLen = (n: number, msg: string): FormValidator => ({
  validate(value: unknown) {
    if (typeof value !== 'string' || value.length < n) {
      return { valid: false, errors: [{ message: msg }] }
    }
    return { valid: true, errors: [] }
  },
})

describe('useForm — values / dirty / reset', () => {
  test('initialValues populate values + dirty/touched empty at start', () => {
    const form = useForm({
      initialValues: { email: '', password: '' },
      onSubmit: async () => {},
    })
    expect(form.values.value).toEqual({ email: '', password: '' })
    expect(form.isDirty.value).toBe(false)
    expect(form.isValid.value).toBe(true)
    expect(form.field('email').touched).toBe(false)
    expect(form.field('email').dirty).toBe(false)
  })

  test('setValue updates field + marks dirty', () => {
    const form = useForm({
      initialValues: { email: '' },
      onSubmit: async () => {},
    })
    form.field('email').setValue('a@b.com')
    expect(form.values.value.email).toBe('a@b.com')
    expect(form.field('email').dirty).toBe(true)
    expect(form.isDirty.value).toBe(true)
  })

  test('setting back to initial clears dirty for that field', () => {
    const form = useForm({
      initialValues: { x: 'hi' },
      onSubmit: async () => {},
    })
    form.field('x').setValue('changed')
    expect(form.field('x').dirty).toBe(true)
    form.field('x').setValue('hi')
    expect(form.field('x').dirty).toBe(false)
  })

  test('reset clears values, errors, touched, dirty, submit state', () => {
    const form = useForm({
      initialValues: { email: '' },
      schema: { email: emailRule },
      onSubmit: async () => {},
    })
    form.field('email').setValue('not-an-email')
    form.field('email').onBlur()
    form.validate()
    expect(form.errors.value.email).toBe('Invalid email')

    form.reset()
    expect(form.values.value).toEqual({ email: '' })
    expect(form.errors.value).toEqual({})
    expect(form.touched.value).toEqual({})
    expect(form.dirty.value).toEqual({})
    expect(form.isSubmitting.value).toBe(false)
    expect(form.isValid.value).toBe(true)
    expect(form.isDirty.value).toBe(false)
  })
})

describe('useForm — validation modes', () => {
  test('default mode (submit) does NOT validate on change or blur', () => {
    const form = useForm({
      initialValues: { email: '' },
      schema: { email: emailRule },
      onSubmit: async () => {},
    })
    form.field('email').setValue('not-an-email')
    expect(form.errors.value.email).toBeUndefined()
    form.field('email').onBlur()
    expect(form.errors.value.email).toBeUndefined()
  })

  test('mode "blur" validates on blur but not change', () => {
    const form = useForm({
      initialValues: { email: '' },
      schema: { email: emailRule },
      onSubmit: async () => {},
      validateOn: 'blur',
    })
    form.field('email').setValue('not-an-email')
    expect(form.errors.value.email).toBeUndefined()
    form.field('email').onBlur()
    expect(form.errors.value.email).toBe('Invalid email')
  })

  test('mode "change" validates every keystroke', () => {
    const form = useForm({
      initialValues: { email: '' },
      schema: { email: emailRule },
      onSubmit: async () => {},
      validateOn: 'change',
    })
    form.field('email').setValue('x')
    expect(form.errors.value.email).toBe('Invalid email')
    form.field('email').setValue('x@y.com')
    expect(form.errors.value.email).toBeUndefined()
  })

  test('validation clears error when field becomes valid', () => {
    const form = useForm({
      initialValues: { email: '' },
      schema: { email: emailRule },
      onSubmit: async () => {},
      validateOn: 'change',
    })
    form.field('email').setValue('bad')
    expect(form.isValid.value).toBe(false)
    form.field('email').setValue('good@x.com')
    expect(form.isValid.value).toBe(true)
    expect(form.errors.value.email).toBeUndefined()
  })
})

describe('useForm — handleSubmit', () => {
  test('calls onSubmit with values when valid', async () => {
    let submitted: Record<string, unknown> | undefined
    const form = useForm({
      initialValues: { email: 'a@b.com', password: 'longpw' },
      schema: { email: emailRule, password: minLen(6, 'Min 6 chars') },
      onSubmit: async (v) => { submitted = v },
    })
    await form.handleSubmit()
    expect(submitted).toEqual({ email: 'a@b.com', password: 'longpw' })
  })

  test('skips onSubmit + surfaces errors when invalid', async () => {
    let called = false
    const form = useForm({
      initialValues: { email: '', password: '' },
      schema: { email: emailRule, password: minLen(6, 'Min 6 chars') },
      onSubmit: async () => { called = true },
    })
    await form.handleSubmit()
    expect(called).toBe(false)
    expect(form.errors.value.email).toBe('Invalid email')
    expect(form.errors.value.password).toBe('Min 6 chars')
  })

  test('marks every field touched on submit attempt', async () => {
    const form = useForm({
      initialValues: { email: '', password: '' },
      schema: { email: emailRule },
      onSubmit: async () => {},
    })
    await form.handleSubmit()
    expect(form.touched.value.email).toBe(true)
    expect(form.touched.value.password).toBe(true)
  })

  test('isSubmitting toggles true→false around onSubmit', async () => {
    let observed = false
    const form = useForm({
      initialValues: { x: 'hi' },
      onSubmit: async () => {
        observed = form.isSubmitting.value
        await tick(5)
      },
    })
    await form.handleSubmit()
    expect(observed).toBe(true)
    expect(form.isSubmitting.value).toBe(false)
  })

  test('throws inside onSubmit surface as form-level error', async () => {
    const form = useForm({
      initialValues: { x: 'hi' },
      onSubmit: async () => { throw new Error('server down') },
    })
    await form.handleSubmit()
    expect(form.errors.value.form).toBe('server down')
    expect(form.isSubmitting.value).toBe(false)
  })

  test('onError fires on validation failure with field-error map', async () => {
    let captured: unknown
    const form = useForm({
      initialValues: { email: '' },
      schema: { email: emailRule },
      onSubmit: async () => {},
      onError: (e) => { captured = e },
    })
    await form.handleSubmit()
    expect(captured).toEqual({ email: 'Invalid email' })
  })
})

describe('useForm — setError / clearErrors (server-side surfacing)', () => {
  test('setError pins a message that survives until cleared', () => {
    const form = useForm({
      initialValues: { email: 'a@b.com' },
      onSubmit: async () => {},
    })
    form.setError('email', 'Already taken')
    expect(form.errors.value.email).toBe('Already taken')
    expect(form.field('email').error).toBe('Already taken')
    expect(form.isValid.value).toBe(false)
  })

  test('setError("form", msg) holds the form-level error (the canonical 422 surfacing path)', () => {
    const form = useForm({
      initialValues: { x: '' },
      onSubmit: async () => {},
    })
    form.setError('form', 'Login failed')
    expect(form.errors.value.form).toBe('Login failed')
  })

  test('setErrors(map) bulk-surfaces a server 422 error map (array → first message)', () => {
    const form = useForm({
      initialValues: { email: '', password: '' },
      onSubmit: async () => {},
    })
    form.setErrors({
      email: ['Already taken', 'second ignored'],
      password: 'Too weak',
      form: 'Registration failed',
    })
    expect(form.errors.value.email).toBe('Already taken')
    expect(form.errors.value.password).toBe('Too weak')
    expect(form.errors.value.form).toBe('Registration failed')
    expect(form.isValid.value).toBe(false)
  })

  test('setErrors ignores null/empty entries and merges with existing errors', () => {
    const form = useForm({ initialValues: { a: '', b: '' }, onSubmit: async () => {} })
    form.setError('a', 'A bad')
    form.setErrors({ b: 'B bad', a: undefined, form: [] })
    expect(form.errors.value.a).toBe('A bad') // untouched (undefined skipped)
    expect(form.errors.value.b).toBe('B bad')
    expect(form.errors.value.form).toBeUndefined() // empty array skipped
  })

  test('clearErrors(field) clears one, clearErrors() clears all', () => {
    const form = useForm({
      initialValues: { a: '', b: '' },
      onSubmit: async () => {},
    })
    form.setError('a', 'A bad')
    form.setError('b', 'B bad')
    form.clearErrors('a')
    expect(form.errors.value.a).toBeUndefined()
    expect(form.errors.value.b).toBe('B bad')
    form.clearErrors()
    expect(form.errors.value).toEqual({})
    expect(form.isValid.value).toBe(true)
  })
})

describe('useForm — field() accessor', () => {
  test('field accessor reflects current state reactively', () => {
    const form = useForm({
      initialValues: { name: 'Alice' },
      schema: { name: minLen(2, 'Too short') },
      onSubmit: async () => {},
      validateOn: 'change',
    })
    const f = form.field('name')
    expect(f.value).toBe('Alice')
    expect(f.error).toBe('')

    f.setValue('X')
    expect(f.value).toBe('X')
    expect(f.error).toBe('Too short')
    expect(f.dirty).toBe(true)
  })

  test('field.validate() returns boolean + sets error', () => {
    const form = useForm({
      initialValues: { name: '' },
      schema: { name: minLen(3, 'Need 3+') },
      onSubmit: async () => {},
    })
    expect(form.field('name').validate()).toBe(false)
    expect(form.errors.value.name).toBe('Need 3+')
    form.field('name').setValue('hello')
    expect(form.field('name').validate()).toBe(true)
    expect(form.errors.value.name).toBeUndefined()
  })

  test('object-shaped validator result is unwrapped to the first message', () => {
    const objShape: FormValidator = {
      validate() {
        return {
          valid: false,
          errors: { firstField: [{ message: 'Nested fail' }] },
        }
      },
    }
    const form = useForm({
      initialValues: { x: '' },
      schema: { x: objShape },
      onSubmit: async () => {},
    })
    form.field('x').validate()
    expect(form.errors.value.x).toBe('Nested fail')
  })
})

describe('useForm — Phase 2 binding helpers (a11y + submit + focus)', () => {
  test('inputProps() returns value + handlers + aria attributes', () => {
    const form = useForm({
      initialValues: { email: '' },
      schema: { email: emailRule },
      onSubmit: async () => {},
    })
    const p = form.field('email').inputProps()
    expect(p.name).toBe('email')
    expect(p.value).toBe('')
    expect(p['aria-invalid']).toBe(false)
    expect(p['aria-describedby']).toBeUndefined()
    expect(typeof p.onInput).toBe('function')
    expect(typeof p.onBlur).toBe('function')
  })

  test('inputProps().onInput accepts a raw value', () => {
    const form = useForm({ initialValues: { email: '' }, onSubmit: async () => {} })
    form.field('email').inputProps().onInput('a@b.com')
    expect(form.values.value.email).toBe('a@b.com')
  })

  test('inputProps().onInput accepts a DOM-event-like object', () => {
    const form = useForm({ initialValues: { email: '' }, onSubmit: async () => {} })
    form.field('email').inputProps().onInput({ target: { value: 'x@y.com' } })
    expect(form.values.value.email).toBe('x@y.com')
  })

  test('aria-invalid + aria-describedby flip on once an error surfaces', () => {
    const form = useForm({
      initialValues: { email: '' },
      schema: { email: emailRule },
      onSubmit: async () => {},
    })
    form.field('email').validate() // produce an error
    const p = form.field('email').inputProps()
    expect(p['aria-invalid']).toBe(true)
    expect(p['aria-describedby']).toBe('email-error')
    expect(form.field('email').errorId).toBe('email-error')
  })

  test('submitButtonProps() reflects isSubmitting', async () => {
    let observed: { disabled: boolean, 'aria-busy': boolean } | undefined
    const form = useForm({
      initialValues: { x: 'hi' },
      onSubmit: async () => {
        observed = form.submitButtonProps()
        await tick(5)
      },
    })
    expect(form.submitButtonProps()).toEqual({ type: 'submit', disabled: false, 'aria-busy': false })
    await form.handleSubmit()
    expect(observed).toEqual({ type: 'submit', disabled: true, 'aria-busy': true })
    expect(form.submitButtonProps().disabled).toBe(false)
  })

  test('firstErrorField() returns the first errored field in initialValues order', async () => {
    const form = useForm({
      initialValues: { email: '', password: '' },
      schema: { email: emailRule, password: minLen(6, 'Min 6') },
      onSubmit: async () => {},
    })
    expect(form.firstErrorField()).toBeNull()
    await form.handleSubmit() // both invalid
    expect(form.firstErrorField()).toBe('email')

    form.field('email').setValue('a@b.com')
    form.field('email').validate()
    expect(form.firstErrorField()).toBe('password') // email fixed → next error
  })
})

describe('useForm — bench-review login flow (integration)', () => {
  test('the bench-review login pattern collapses into the documented shape', async () => {
    const calls: string[] = []
    const form = useForm({
      initialValues: { email: '', password: '' },
      schema: {
        email: emailRule,
        password: minLen(6, 'Min 6 characters'),
      },
      onSubmit: async (values) => {
        calls.push(`login:${values.email}:${values.password}`)
        if (values.email === 'bad@x.com') {
          throw new Error('Invalid credentials')
        }
      },
    })

    // First submit: empty fields → both errors surface
    await form.handleSubmit()
    expect(calls).toHaveLength(0)
    expect(form.errors.value.email).toBe('Invalid email')
    expect(form.errors.value.password).toBe('Min 6 characters')

    // Fill in good values → submit succeeds
    form.field('email').setValue('user@x.com')
    form.field('password').setValue('correct-horse')
    await form.handleSubmit()
    expect(calls).toEqual(['login:user@x.com:correct-horse'])

    // Server rejects → form-level error
    form.field('email').setValue('bad@x.com')
    await form.handleSubmit()
    expect(form.errors.value.form).toBe('Invalid credentials')
  })
})
