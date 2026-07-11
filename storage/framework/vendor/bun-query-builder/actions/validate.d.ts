/**
 * Validate that models match the database schema
 */
export declare function validateSchema(dir?: string): Promise<ValidationResult>;
/**
 * Check schema (alias for validateSchema)
 */
export declare function checkSchema(dir?: string): Promise<ValidationResult>;
export declare interface ValidationIssue {
  type: 'missing_table' | 'extra_table' | 'missing_column' | 'extra_column' | 'type_mismatch'
  severity: 'error' | 'warning'
  table?: string
  column?: string
  expected?: string
  actual?: string
  message: string
}
export declare interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}
