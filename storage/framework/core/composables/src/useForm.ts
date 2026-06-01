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

export interface FormFieldAccessor<T> {
  /** Current value (use in `x-model` and `:value`). */
  value: T
  /** First error message for the field, or empty string. */
  error: string
  /** True after the user has blurred this field at least once. */
  touched: boolean
  /** True when the value differs from `initialValues[name]`. */
  dirty: boolean
  /** Set value + (per mode) re-validate. */
  setValue: (next: T) => void
  /** Mark touched + (per mode) re-validate on blur. */
  onBlur: () => void
  /** Force-validate just this field. Returns true if valid. */
  validate: () => boolean
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
    return {
      get value() { return values.value[name] },
      get error() { return errors.value[name as string] ?? '' },
      get touched() { return !!touched.value[name as string] },
      get dirty() { return !!dirty.value[name as string] },
      setValue: (next: TValues[K]) => setFieldValue(name, next),
      onBlur: () => {
        setFieldTouched(name, true)
        if (validateOn === 'blur' || validateOn === 'change') validateField(name)
      },
      validate: () => validateField(name),
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
    clearErrors,
    setTouched: setFieldTouched,
    validate: validateAll,
    handleSubmit,
    reset,
  }
}
