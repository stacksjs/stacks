export type FormFieldType
  = | 'text' | 'textarea' | 'email' | 'phone' | 'select' | 'checkbox'
    | 'radio' | 'date' | 'file' | 'currency' | 'section_break'

export interface FieldChoice {
  label: string
  value: string
}

export interface FieldOptions {
  placeholder?: string
  choices?: FieldChoice[]
  min?: number
  max?: number
  accept?: string[]
  maxSizeMb?: number
  /** For `currency` fields with a fixed amount (integer cents). */
  amountCents?: number
}

export interface FieldConditions {
  action: 'show' | 'hide'
  logic: 'all' | 'any'
  rules: {
    field: string
    op: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'empty' | 'not_empty'
    value?: string | number
  }[]
}

/** The runtime shape of a form field, parsed from its row. */
export interface FormFieldDefinition {
  name: string
  label: string
  type: FormFieldType
  required: boolean
  position: number
  width: 'full' | 'half'
  options: FieldOptions
  conditions: FieldConditions | null
}

export interface FormSettings {
  submitLabel?: string
  confirmation?: { type: 'message' | 'redirect', value: string }
  notifyEmails?: string[]
  /** Which field supplies the typed `email` column. Default: first email field. */
  emailField?: string
  /** Which field supplies the typed `name` column. Default: first text field named like a name. */
  nameField?: string
  payment?: {
    mode: 'fixed' | 'user_amount' | 'field_sum'
    amountCents?: number
    currency?: string
    /** For user_amount: the field carrying the chosen amount (a currency field). */
    amountField?: string
    /** For user_amount: the floor in cents. */
    minAmountCents?: number
  }
}

export interface FormDefinition {
  id: number
  uuid: string
  siteId: number | null
  name: string
  handle: string
  status: 'draft' | 'active' | 'closed'
  settings: FormSettings
  fields: FormFieldDefinition[]
}

/**
 * A field as the public renderer receives it.
 *
 * The same field minus what only the server needs. Derived from
 * `FormFieldDefinition` rather than restated, so adding a field property
 * cannot leave the two out of step.
 */
export type PublicFormField
  = Pick<FormFieldDefinition, 'name' | 'label' | 'type' | 'required' | 'width' | 'conditions'>
    & { options: Pick<FieldOptions, 'placeholder' | 'choices' | 'min' | 'max' | 'accept'> }

/**
 * What `GET /api/forms/:uuid` returns: everything a renderer needs, nothing an
 * attacker wants.
 *
 * `publicDefinition` used to be typed `Record<string, unknown>`, so the one
 * contract between the server projection and the CMS form block was described
 * nowhere. The block rendered a `state(null)` it then indexed freely, and the
 * server could have dropped a key without anything noticing.
 */
export interface PublicFormDefinition {
  uuid: string
  name: string
  status: FormDefinition['status']
  submitLabel: string
  confirmation: string | null
  payment: {
    mode: NonNullable<FormSettings['payment']>['mode']
    amountCents?: number
    currency: string
    minAmountCents?: number
  } | null
  fields: PublicFormField[]
}

export interface SubmissionErrors {
  [fieldName: string]: string
}

export type ValidateSubmissionResult
  = | { ok: true, values: Record<string, unknown>, email: string | null, name: string | null, amountCents: number | null }
    | { ok: false, errors: SubmissionErrors }
