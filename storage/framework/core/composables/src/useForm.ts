import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

/**
 * useForm (stacksjs/stacks#1940 — Phase 1).
 *
 * Per-field state + schema validation + submit orchestration.
 * Builds on `@stacksjs/validation`'s ts-validation surface — pass any
 * field-keyed bag of `schema.string()...` etc. and the composable
 * runs `.validate(value)` to surface the first message.
 *
 * Phase 1 deliberately ships the primitive only; the `<Field>` /
 * `<SubmitButton>` / `<ErrorMessage>` companion components, field
 * arrays, server-error auto-surfacing on 422, and progressive HTML
 * fallback are scoped to Phases 2-5 of the issue.
 */

/** Minimal Validator surface this composable depends on. */
export interface FormValidator {
  validate: (value: unknown) => { valid: boolean, errors: Array<{ message: string }> | Record<string, Array<{ message: string }>> }
}

/**
 * Trigger that causes a field to validate.
 * - 'change' — every time the value changes (eager — best for password strength meters)
 * - 'blur'   — when the user moves focus away from the field (default — most natural)
 * - 'submit' — only at submit time (lazy — best for short forms with required-only checks)
 */
export type ValidationMode = 'change' | 'blur' | 'submit'

export interface UseFormOptions<TValues extends Record<string, unknown>> {
  initialValues: TValues
  /**
   * Field-keyed bag of validators. Missing keys mean "no per-field rule"
   * (the field is treated as always-valid).
   */
  schema?: Partial<Record<keyof TValues, FormValidator>>
  /** Called with the final values when the form passes validation. */
  onSubmit: (values: TValues) => Promise<void> | void
  /** Called when submit throws or validation fails. Optional. */
  onError?: (error: Error | Record<string, string>) => void
  /**
   * When to run field validation.
   *   - 'submit' (default): only on submit
   *   - 'blur':   on blur + on submit
   *   - 'change': on every value change + on submit
   * Submit always runs validation regardless of mode.
   */
  validateOn?: ValidationMode
}

/**
 * A ready-to-spread bag of input attributes + handlers for one field
 * (stacksjs/stacks#1940 Phase 2). Encodes the a11y wiring a `<Field>`
 * component would otherwise re-derive by hand: `aria-invalid` flips on a
 * surfaced error, and `aria-describedby` points at the error element's
 * stable id so screen readers announce the message.
 */
export interface FieldInputProps<T> {
  name: string
  value: T
  /** Accepts a raw value OR a DOM-event-like `{ target: { value } }`. */
  onInput: (eventOrValue: unknown) => void
  onBlur: () => void
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

export interface FormFieldAccessor<T> {
  /** Current value (use in `x-model` and `:value`). */
  value: T
  /** First error message for the field, or empty string. */
  error: string
  /** True after the user has blurred this field at least once. */
  touched: boolean
  /** True when the value differs from `initialValues[name]`. */
  dirty: boolean
  /** Stable id for the field's error element — the `aria-describedby` target. */
  errorId: string
  /** Set value + (per mode) re-validate. */
  setValue: (next: T) => void
  /** Mark touched + (per mode) re-validate on blur. */
  onBlur: () => void
  /** Force-validate just this field. Returns true if valid. */
  validate: () => boolean
  /** A spreadable input prop bag (value + handlers + a11y attributes). */
  inputProps: () => FieldInputProps<T>
}

export interface UseFormResult<TValues extends Record<string, unknown>> {
  values: Ref<TValues>
  errors: Ref<Record<string, string>>
  touched: Ref<Record<string, boolean>>
  dirty: Ref<Record<string, boolean>>
  isSubmitting: Ref<boolean>
  isValid: Ref<boolean>
  /** True once any field has been touched or any value changed. */
  isDirty: Ref<boolean>
  /** Reactive accessor for one field (use in templates). */
  field: <K extends keyof TValues>(name: K) => FormFieldAccessor<TValues[K]>
  /** Imperatively set a single field's value (also re-validates per mode). */
  setValue: <K extends keyof TValues>(name: K, value: TValues[K]) => void
  /** Set or clear a single field's error message. */
  setError: (name: keyof TValues | 'form', message: string) => void
  /**
   * Bulk-set field errors from a server error map (stacksjs/stacks#1940
   * Phase 3 foundation). Accepts the canonical 422 shape an Action validator
   * returns — `{ email: ['Already taken'], password: 'Too short' }` — taking
   * the first message of an array. The client wiring that calls this on a 422
   * response is the remaining Phase 3 work.
   */
  setErrors: (errorMap: Partial<Record<keyof TValues | 'form', string | string[]>>) => void
  /** Clear errors — either a single field or all of them. */
  clearErrors: (name?: keyof TValues | 'form') => void
  /** Mark a field touched. */
  setTouched: (name: keyof TValues, touched?: boolean) => void
  /** Run every field validator + the optional form validator. */
  validate: () => boolean
  /** Validate, then call onSubmit if valid. */
  handleSubmit: () => Promise<void>
  /** Reset every field to its initialValue. */
  reset: () => void
  /**
   * A spreadable prop bag for a submit button (stacksjs/stacks#1940 Phase 2):
   * `disabled` + `aria-busy` while submitting, plus `type: 'submit'`. Closes
   * the "I forgot to disable the submit button" footgun.
   */
  submitButtonProps: () => { type: 'submit', disabled: boolean, 'aria-busy': boolean }
  /**
   * The first field (in `initialValues` order) that currently has an error,
   * or null. For focus-the-first-error-on-failed-submit — the component reads
   * this and calls `.focus()` on the matching input.
   */
  firstErrorField: () => keyof TValues | null
}

/**
 * Reactive form primitive with schema validation + submit orchestration.
 *
 * @example
 * ```ts
 * const form = useForm({
 *   initialValues: { email: '', password: '' },
 *   schema: {
 *     email: schema.string().email().required(),
 *     password: schema.string().min(6).required(),
 *   },
 *   onSubmit: async (values) => {
 *     const r = await authStore.login(values)
 *     if (!r.ok) form.setError('form', r.error)
 *   },
 * })
 * ```
 */
export function useForm<TValues extends Record<string, unknown>>(
  opts: UseFormOptions<TValues>,
): UseFormResult<TValues> {
  const validateOn: ValidationMode = opts.validateOn ?? 'submit'
  const initial = { ...opts.initialValues }

  const values = ref<TValues>({ ...initial }) as Ref<TValues>
  const errors = ref<Record<string, string>>({}) as Ref<Record<string, string>>
  const touched = ref<Record<string, boolean>>({}) as Ref<Record<string, boolean>>
  const dirty = ref<Record<string, boolean>>({}) as Ref<Record<string, boolean>>
  const isSubmitting = ref<boolean>(false)
  const isValid = ref<boolean>(true)
  const isDirty = ref<boolean>(false)

  function firstMessage(result: ReturnType<FormValidator['validate']>): string {
    if (result.valid) return ''
    if (Array.isArray(result.errors)) {
      return result.errors[0]?.message ?? 'Invalid'
    }
    // Object-validator shape (per-field map) — surface the first message we find.
    for (const list of Object.values(result.errors)) {
      if (list.length > 0) return list[0]?.message ?? 'Invalid'
    }
    return 'Invalid'
  }

  function validateField<K extends keyof TValues>(name: K): boolean {
    const v = opts.schema?.[name]
    if (!v) return true
    const result = v.validate(values.value[name])
    const message = firstMessage(result)
    if (message) {
      errors.value = { ...errors.value, [name as string]: message }
      isValid.value = false
      return false
    }
    if (errors.value[name as string]) {
      const { [name as string]: _, ...rest } = errors.value
      errors.value = rest
    }
    isValid.value = Object.keys(errors.value).length === 0
    return true
  }

  function setFieldValue<K extends keyof TValues>(name: K, value: TValues[K]): void {
    values.value = { ...values.value, [name]: value }
    dirty.value = { ...dirty.value, [name as string]: value !== initial[name] }
    isDirty.value = true
    if (validateOn === 'change') validateField(name)
  }

  function setFieldTouched(name: keyof TValues, isTouched: boolean = true): void {
    touched.value = { ...touched.value, [name as string]: isTouched }
    if (isTouched) isDirty.value = true
  }

  function field<K extends keyof TValues>(name: K): FormFieldAccessor<TValues[K]> {
    const key = name as string
    const errorId = `${key}-error`
    const onBlur = (): void => {
      setFieldTouched(name, true)
      if (validateOn === 'blur' || validateOn === 'change') validateField(name)
    }
    return {
      get value() { return values.value[name] },
      get error() { return errors.value[key] ?? '' },
      get touched() { return !!touched.value[key] },
      get dirty() { return !!dirty.value[key] },
      errorId,
      setValue: (next: TValues[K]) => setFieldValue(name, next),
      onBlur,
      validate: () => validateField(name),
      inputProps: (): FieldInputProps<TValues[K]> => {
        const hasError = !!errors.value[key]
        return {
          name: key,
          value: values.value[name],
          onInput: (eventOrValue: unknown) => {
            // Accept a raw value OR a DOM-event-like `{ target: { value } }`.
            const next = (eventOrValue
              && typeof eventOrValue === 'object'
              && 'target' in eventOrValue)
              ? (eventOrValue as { target: { value: unknown } }).target.value
              : eventOrValue
            setFieldValue(name, next as TValues[K])
          },
          onBlur,
          'aria-invalid': hasError,
          'aria-describedby': hasError ? errorId : undefined,
        }
      },
    }
  }

  function validateAll(): boolean {
    let ok = true
    for (const name of Object.keys(opts.schema ?? {}) as Array<keyof TValues>) {
      if (!validateField(name)) ok = false
    }
    return ok
  }

  function setError(name: keyof TValues | 'form', message: string): void {
    errors.value = { ...errors.value, [name as string]: message }
    isValid.value = false
  }

  function setErrors(errorMap: Partial<Record<keyof TValues | 'form', string | string[]>>): void {
    const next = { ...errors.value }
    let changed = false
    // Explicit entry type: a generic-keyed `Partial<Record>` loses the precise
    // value type through `Object.entries`, so annotate it for `Array.isArray`
    // to narrow `string[]` → first message.
    const list = Object.entries(errorMap) as Array<[string, string | string[] | undefined]>
    for (const [key, msg] of list) {
      if (msg == null) continue
      const message = Array.isArray(msg) ? msg[0] : msg
      if (message == null || message === '') continue
      next[key] = message
      changed = true
    }
    errors.value = next
    if (changed) isValid.value = false
  }

  function clearErrors(name?: keyof TValues | 'form'): void {
    if (name == null) {
      errors.value = {}
      isValid.value = true
      return
    }
    const { [name as string]: _, ...rest } = errors.value
    errors.value = rest
    isValid.value = Object.keys(errors.value).length === 0
  }

  async function handleSubmit(): Promise<void> {
    // Mark every field touched so error messages show on first submit
    const allTouched: Record<string, boolean> = {}
    for (const k of Object.keys(values.value)) allTouched[k] = true
    touched.value = allTouched

    if (!validateAll()) {
      opts.onError?.(errors.value)
      return
    }

    isSubmitting.value = true
    try {
      await opts.onSubmit(values.value)
    }
    catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err))
      setError('form', e.message)
      opts.onError?.(e)
    }
    finally {
      isSubmitting.value = false
    }
  }

  function reset(): void {
    values.value = { ...initial }
    errors.value = {}
    touched.value = {}
    dirty.value = {}
    isSubmitting.value = false
    isValid.value = true
    isDirty.value = false
  }

  function submitButtonProps(): { type: 'submit', disabled: boolean, 'aria-busy': boolean } {
    return {
      type: 'submit',
      disabled: isSubmitting.value,
      'aria-busy': isSubmitting.value,
    }
  }

  function firstErrorField(): keyof TValues | null {
    // initialValues order is the field order; surface the first that errors.
    for (const k of Object.keys(initial) as Array<keyof TValues>) {
      if (errors.value[k as string]) return k
    }
    return null
  }

  return {
    values,
    errors,
    touched,
    dirty,
    isSubmitting,
    isValid,
    isDirty,
    field,
    setValue: setFieldValue,
    setError,
    setErrors,
    clearErrors,
    setTouched: setFieldTouched,
    validate: validateAll,
    handleSubmit,
    reset,
    submitButtonProps,
    firstErrorField,
  }
}
