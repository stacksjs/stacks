/**
 * Thanks to VineJS for the following types:
 *
 * The context shared with the entire validation pipeline.
 * Each field gets its own context object.
 */
export interface FieldContext {
  /**
   * Field value
   */
  value: unknown

  /**
   * The data property is the top-level object under validation.
   */
  data: any

  /**
   * Shared metadata across the entire validation lifecycle. It can be
   * used to pass data between validation rules
   */
  meta: Record<string, any>

  /**
   * Mutate the value of field under validation.
   */
  mutate: (newValue: any, field: FieldContext) => void

  /**
   * Report error to the error reporter
   */
  report: ErrorReporterContract['report']

  /**
   * Is this field valid. Default: true
   */
  isValid: boolean

  /**
   * Is this field has value defined.
   */
  isDefined: boolean

  /**
   * Wildcard path for the field. The value is a nested
   * pointer to the field under validation.
   *
   * In case of arrays, the `*` wildcard is used.
   */
  wildCardPath: string

  /**
   * The parent property is the parent of the field. It could be an
   * array or an object.
   */
  parent: any

  /**
   * Name of the field under validation. In case of an array, the field
   * name will be a number
   */
  name: string | number

  /**
   * Is this field an array member
   */
  isArrayMember: boolean
}

/**
 * Thanks to VineJS for the following types:
 *
 * The error reporter is used to report errors during the validation
 * process.
 */
export interface ErrorReporterContract {
  /**
   * A boolean to known if there are one or more
   * errors.
   */
  hasErrors: boolean

  /**
   * Creates an instance of an exception to throw
   */
  createError: () => Error

  /**
   * Report error for a field
   */
  report: (message: string, rule: string, field: FieldContext, args?: Record<string, any>) => any
}
