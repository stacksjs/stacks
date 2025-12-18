// Validation types - no longer using VineJS
export interface ValidationResult {
  valid: boolean
  errors?: Array<{ message: string }>
}

export interface ValidationRule {
  validate: (value: unknown) => ValidationResult
}

export type ValidationBoolean = ValidationRule
export type ValidationEnum = ValidationRule
export type ValidationNumber = ValidationRule
export type ValidationString = ValidationRule
