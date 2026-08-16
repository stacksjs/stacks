/**
 * Form-builder configuration: user-defined forms (Form / FormField /
 * FormSubmission), runtime validation, conditional visibility, public
 * submit endpoints, uploads, payments and CSV export.
 */
export interface FormsOptions {
  /** Feature gate for the whole bundle. */
  enabled: boolean

  /** File-upload fields. */
  uploads?: {
    /** Storage disk name. Defaults to the app's default disk. */
    disk?: string
    /** Per-file ceiling in megabytes. @default 10 */
    maxSizeMb?: number
    /** Allowed extensions (lowercase, no dot). @default common docs/images */
    allowedTypes?: string[]
  }

  /** Spam controls on the public submit endpoint. */
  spam?: {
    /** Reject submissions whose hidden honeypot field is filled. @default true */
    honeypot?: boolean
    /** Reject submissions arriving faster than a human could type. @default 3 */
    minSubmitSeconds?: number
  }
}

export type FormsConfig = Partial<FormsOptions>
