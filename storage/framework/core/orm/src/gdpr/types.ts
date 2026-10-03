/**
 * The GDPR vocabulary a model declares (stacksjs/stacks#365).
 *
 * Two places, both on the model, so the schema and the obligations attached to
 * it cannot drift apart:
 *
 * - `personal` on an attribute marks a column as personal data. It is what an
 *   access request exports and what erasure and retention anonymize.
 * - `traits.gdpr` on the model says whose data the rows are (`subject`), what
 *   erasure does to them (`erasure`), how long they are kept (`retention`), and
 *   why they are held at all (`purpose`, `basis`) - the last two exist for the
 *   processing register, which is generated from these declarations rather
 *   than kept by hand.
 *
 * ```ts
 * defineModel({
 *   name: 'Order',
 *   belongsTo: ['Customer'],
 *   traits: {
 *     gdpr: {
 *       subject: { via: 'Customer' },
 *       erasure: 'anonymize',
 *       basis: 'legal_obligation',
 *       purpose: 'Order fulfilment and tax records',
 *       retention: { days: 3650, action: 'anonymize' },
 *     },
 *   },
 *   attributes: {
 *     deliveryAddress: { personal: true, validation: { rule: schema.string() } },
 *   },
 * })
 * ```
 *
 * The declaration types live in `@stacksjs/types` with the rest of the model
 * vocabulary; the resolved shapes the engine works with are here.
 */

import type {
  GdprErasureAction,
  GdprLawfulBasis,
  GdprRetentionAction,
  GdprRetentionPolicy,
  GdprSubject,
  GdprTraitOptions,
  PersonalAttribute,
  PersonalAttributeOptions,
} from '@stacksjs/types'

export type {
  GdprErasureAction,
  GdprLawfulBasis,
  GdprRetentionAction,
  GdprRetentionPolicy,
  GdprSubject,
  GdprTraitOptions,
  PersonalAttribute,
  PersonalAttributeOptions,
}

/** A model definition, as much of it as the GDPR layer reads. */
export interface GdprModelDefinition {
  readonly name?: string
  readonly table?: string
  readonly primaryKey?: string
  readonly belongsTo?: unknown
  readonly traits?: Readonly<Record<string, unknown>> & { readonly gdpr?: GdprTraitOptions }
  readonly attributes?: Readonly<Record<string, unknown>>
}

export type GdprModels = Readonly<Record<string, GdprModelDefinition>> | readonly GdprModelDefinition[]

/** One personal column, resolved. */
export interface GdprPersonalField {
  attribute: string
  column: string
  export: boolean
  /** True when anonymization writes a per-row value (`erased-<id>`). */
  perRow: boolean
  /** The fixed value anonymization writes, when not per-row. */
  anonymizeTo: string | number | boolean | null
}

/** How a model's rows are matched to a subject, resolved to columns. */
export type GdprSubjectLink =
  | { kind: 'column', columns: string[], where: Record<string, string | number | boolean> }
  | { kind: 'via', model: string, foreignKey: string }
  | { kind: 'email', column: string }

/** Everything the GDPR layer knows about one model. */
export interface GdprModelPlan {
  model: string
  table: string
  primaryKey: string
  subject: GdprSubjectLink | null
  personal: GdprPersonalField[]
  erasure: GdprErasureAction
  retention: { days: number, column: string, action: GdprRetentionAction } | null
  purpose: string | null
  basis: GdprLawfulBasis | null
  /** How many `via` hops separate this model from a direct subject link. */
  depth: number
  /** Columns an export carries besides the personal ones, when the table has them. */
  exportColumns: string[]
}

export interface GdprDeclarationProblem {
  model: string
  message: string
}

export interface GdprPlan {
  /** Models that declare personal data, a `gdpr` trait, or both. */
  models: GdprModelPlan[]
  /** Models that point at the User model but declare nothing - unclassified. */
  unclassified: string[]
  problems: GdprDeclarationProblem[]
}

/** The subject an access or erasure request is about. */
export interface GdprSubjectIdentity {
  id: number | string
  email: string | null
}

export interface GdprExport {
  subject: { id: number | string }
  generatedAt: string
  /** Rows per model, holding only the declared personal fields plus ids and timestamps. */
  data: Record<string, Array<Record<string, unknown>>>
  /** Why each model in `data` holds the subject's data, and for how long. */
  processing: Record<string, { purpose: string | null, basis: GdprLawfulBasis | null, retentionDays: number | null }>
}

export interface GdprModelChange {
  model: string
  table: string
  action: GdprErasureAction | GdprRetentionAction
  /** Rows matched to the subject (erasure) or past the policy (retention). */
  matched: number
  /** Rows that were - or, in a dry run, would be - changed. */
  changed: number
  /** The columns anonymization writes. Empty for a delete. */
  fields: string[]
}

export interface GdprErasureResult {
  subject: { id: number | string }
  dryRun: boolean
  changes: GdprModelChange[]
  /** Tables a model declares that do not exist in this database. */
  skipped: string[]
  /** Whether the subject's tokens and sessions were revoked. */
  credentialsRevoked: boolean
}

export interface GdprPruneResult {
  dryRun: boolean
  cutoffs: Record<string, string>
  changes: GdprModelChange[]
  skipped: string[]
}
