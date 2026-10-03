import type {
  GdprDeclarationProblem,
  GdprErasureAction,
  GdprLawfulBasis,
  GdprModelDefinition,
  GdprModelPlan,
  GdprModels,
  GdprPersonalField,
  GdprPlan,
  GdprRetentionAction,
  GdprSubjectLink,
  GdprTraitOptions,
  PersonalAttributeOptions,
} from './types'
import { plural, snakeCase } from '@stacksjs/strings'

/**
 * Read the GDPR declarations off a set of model definitions.
 *
 * Pure: no database, no filesystem. Everything the engine, the commands and the
 * processing register know about personal data comes through here, so the
 * three cannot disagree about which columns are personal or what erasure does
 * to them.
 *
 * A declaration that cannot be honoured is a problem, not a guess. A NOT NULL
 * enum marked personal has no value anonymization could safely write, and a
 * `via` naming a parent that is nobody's data has no rows to follow - each is
 * reported by model, and `assertGdprPlan` refuses to run an export or an
 * erasure while any remain. An erasure that silently skipped a table is the
 * failure this whole layer exists to prevent.
 */

const ERASURE_ACTIONS: ReadonlySet<GdprErasureAction> = new Set(['anonymize', 'delete', 'keep'])
const RETENTION_ACTIONS: ReadonlySet<GdprRetentionAction> = new Set(['anonymize', 'delete'])
const LAWFUL_BASES: ReadonlySet<GdprLawfulBasis> = new Set([
  'consent',
  'contract',
  'legal_obligation',
  'vital_interests',
  'public_task',
  'legitimate_interests',
])

/** The model whose rows ARE the data subjects. */
export const GDPR_SUBJECT_MODEL = 'User'

/** Raised when a declaration cannot be honoured; carries every problem at once. */
export class GdprDeclarationError extends Error {
  readonly problems: GdprDeclarationProblem[]

  constructor(problems: GdprDeclarationProblem[]) {
    super(`GDPR declarations cannot be honoured:\n${problems.map(p => `  - ${p.model}: ${p.message}`).join('\n')}`)
    this.name = 'GdprDeclarationError'
    this.problems = problems
  }
}

interface BelongsToEntry {
  model: string
  foreignKey: string
}

function modelList(models: GdprModels): Array<{ name: string, definition: GdprModelDefinition }> {
  const entries = Array.isArray(models)
    ? (models as readonly GdprModelDefinition[]).map(definition => [definition.name ?? '', definition] as const)
    : Object.entries(models as Readonly<Record<string, GdprModelDefinition>>)

  return entries
    .map(([key, definition]) => ({ name: String(definition?.name ?? key), definition }))
    .filter(entry => entry.name && entry.definition && typeof entry.definition === 'object')
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function gdprTableName(name: string, definition: GdprModelDefinition): string {
  return definition.table ?? snakeCase(plural(name))
}

function belongsToEntries(definition: GdprModelDefinition): BelongsToEntry[] {
  const raw = definition.belongsTo
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw as Record<string, unknown>)
      : []

  const entries: BelongsToEntry[] = []
  for (const item of list) {
    if (typeof item === 'string') {
      entries.push({ model: item, foreignKey: `${snakeCase(item)}_id` })
      continue
    }
    if (item && typeof item === 'object' && typeof (item as { model?: unknown }).model === 'string') {
      const relation = item as { model: string, foreignKey?: string }
      entries.push({ model: relation.model, foreignKey: relation.foreignKey ?? `${snakeCase(relation.model)}_id` })
    }
  }
  return entries
}

function personalOptions(value: unknown): PersonalAttributeOptions | null {
  if (value === true)
    return {}
  if (value && typeof value === 'object')
    return value as PersonalAttributeOptions
  return null
}

interface AttributeShape {
  required?: boolean
  nullable?: boolean
  unique?: boolean
  type?: string
  personal?: unknown
  validation?: { rule?: { name?: string } }
}

/**
 * What anonymization writes into one column, or why nothing safe exists.
 *
 * NULL wherever the column allows it: the absence of a value is the only
 * anonymized value that cannot be mistaken for data. A NOT NULL column gets a
 * placeholder of its own type, unique per row when the column is unique.
 */
function anonymizedValue(attribute: AttributeShape, options: PersonalAttributeOptions): { perRow: boolean, value: string | number | boolean | null } | { problem: string } {
  if (options.anonymize !== undefined)
    return { perRow: false, value: options.anonymize }

  const notNull = attribute.required === true && attribute.nullable !== true
  if (!notNull)
    return { perRow: false, value: null }

  const type = attribute.validation?.rule?.name ?? attribute.type ?? 'string'

  if (type === 'string' || type === 'text')
    return attribute.unique ? { perRow: true, value: null } : { perRow: false, value: '[erased]' }
  if (attribute.unique)
    return { problem: `is a NOT NULL unique ${type} column; declare personal: { anonymize: <value> } or make it nullable` }
  if (type === 'number' || type === 'integer' || type === 'float' || type === 'decimal')
    return { perRow: false, value: 0 }
  if (type === 'boolean')
    return { perRow: false, value: false }
  if (type === 'json')
    return { perRow: false, value: '{}' }

  return { problem: `is a NOT NULL ${type} column with no safe placeholder; declare personal: { anonymize: <value> }` }
}

export function resolveGdprPlan(models: GdprModels): GdprPlan {
  const plans = new Map<string, GdprModelPlan>()
  // The parent each `via` subject names, kept beside the plans rather than on them.
  const viaOf = new Map<string, string>()
  const unclassified: string[] = []
  const problems: GdprDeclarationProblem[] = []
  const problem = (model: string, message: string): void => {
    problems.push({ model, message })
  }

  for (const { name, definition } of modelList(models)) {
    const attributes = (definition.attributes ?? {}) as Record<string, AttributeShape>
    const gdpr = definition.traits?.gdpr as GdprTraitOptions | undefined
    const belongsTo = belongsToEntries(definition)
    const userRelation = belongsTo.find(entry => entry.model === GDPR_SUBJECT_MODEL)

    const personalAttributes = Object.entries(attributes)
      .map(([attribute, shape]) => ({ attribute, shape, options: personalOptions(shape?.personal) }))
      .filter((entry): entry is { attribute: string, shape: AttributeShape, options: PersonalAttributeOptions } => entry.options !== null)

    if (!gdpr && personalAttributes.length === 0) {
      if (userRelation && name !== GDPR_SUBJECT_MODEL)
        unclassified.push(name)
      continue
    }

    if (gdpr !== undefined && (gdpr === null || typeof gdpr !== 'object')) {
      problem(name, '`traits.gdpr` must be an object')
      continue
    }

    const table = gdprTableName(name, definition)
    const primaryKey = definition.primaryKey ?? 'id'

    // Subject.
    let subject: GdprSubjectLink | null = null
    let via: string | undefined
    const declared = gdpr?.subject

    if (declared === undefined) {
      if (name === GDPR_SUBJECT_MODEL)
        subject = { kind: 'column', columns: [primaryKey], where: {} }
      else if (userRelation)
        subject = { kind: 'column', columns: [userRelation.foreignKey], where: {} }
    }
    else if (typeof declared === 'string') {
      subject = { kind: 'column', columns: [declared], where: {} }
    }
    else if (Array.isArray(declared)) {
      subject = { kind: 'column', columns: [...declared].map(String), where: {} }
    }
    else if (declared && typeof declared === 'object' && 'column' in declared) {
      const columns = Array.isArray(declared.column) ? [...declared.column].map(String) : [String(declared.column)]
      subject = { kind: 'column', columns, where: { ...(declared.where ?? {}) } }
    }
    else if (declared && typeof declared === 'object' && 'via' in declared) {
      const relation = belongsTo.find(entry => entry.model === declared.via)
      if (!relation) {
        problem(name, `subject { via: '${declared.via}' } names a model this one does not declare in belongsTo`)
      }
      else {
        via = relation.model
        subject = { kind: 'via', model: relation.model, foreignKey: relation.foreignKey }
      }
    }
    else if (declared && typeof declared === 'object' && 'email' in declared) {
      subject = { kind: 'email', column: String(declared.email) }
    }
    else {
      problem(name, 'subject must be a column name, a list of columns, { column, where }, { via } or { email }')
    }

    if (subject?.kind === 'column' && subject.columns.length === 0)
      problem(name, 'subject names no column')

    // Erasure.
    const erasure = (gdpr?.erasure ?? 'anonymize') as GdprErasureAction
    if (!ERASURE_ACTIONS.has(erasure))
      problem(name, `erasure must be one of ${[...ERASURE_ACTIONS].join(', ')}, got '${String(erasure)}'`)

    // Retention.
    let retention: GdprModelPlan['retention'] = null
    if (gdpr?.retention !== undefined) {
      const policy = gdpr.retention
      const action = (policy?.action ?? 'delete') as GdprRetentionAction
      if (!policy || typeof policy !== 'object' || !Number.isInteger(policy.days) || policy.days <= 0)
        problem(name, 'retention.days must be a positive whole number of days')
      else if (!RETENTION_ACTIONS.has(action))
        problem(name, `retention.action must be one of ${[...RETENTION_ACTIONS].join(', ')}, got '${String(action)}'`)
      else
        retention = { days: policy.days, column: policy.column ?? 'created_at', action }
    }

    if (gdpr?.basis !== undefined && !LAWFUL_BASES.has(gdpr.basis))
      problem(name, `basis must be one of ${[...LAWFUL_BASES].join(', ')}, got '${String(gdpr.basis)}'`)

    // Personal fields, and whether anonymization can be honoured for each.
    const anonymizes = (erasure === 'anonymize' && subject !== null) || retention?.action === 'anonymize'
    const personal: GdprPersonalField[] = []
    for (const { attribute, shape, options } of personalAttributes) {
      const resolved = anonymizedValue(shape, options)
      if ('problem' in resolved) {
        if (anonymizes)
          problem(name, `personal attribute '${attribute}' ${resolved.problem}`)
        personal.push({ attribute, column: snakeCase(attribute), export: options.export !== false, perRow: false, anonymizeTo: null })
        continue
      }
      personal.push({
        attribute,
        column: snakeCase(attribute),
        export: options.export !== false,
        perRow: resolved.perRow,
        anonymizeTo: resolved.value,
      })
    }

    if (subject !== null && erasure === 'anonymize' && personal.length === 0)
      problem(name, `declares a subject but no personal attributes, so 'anonymize' would change nothing; mark the personal attributes, or declare erasure 'keep' or 'delete'`)
    if (retention?.action === 'anonymize' && personal.length === 0)
      problem(name, `retention anonymizes, but no attribute is marked personal`)

    plans.set(name, {
      model: name,
      table,
      primaryKey,
      subject,
      personal,
      erasure,
      retention,
      purpose: gdpr?.purpose ?? null,
      basis: gdpr?.basis ?? null,
      depth: 0,
      exportColumns: [...new Set([primaryKey, 'uuid', 'created_at', 'updated_at'])],
    })
    if (via)
      viaOf.set(name, via)
  }

  // `via` chains: the parent must itself be somebody's data, and the chain must end.
  const depthOf = (name: string, seen: Set<string>): number | null => {
    const via = viaOf.get(name)
    if (!via)
      return 0
    if (seen.has(name))
      return null
    const parent = plans.get(via)
    if (!parent?.subject)
      return null
    seen.add(name)
    const parentDepth = depthOf(via, seen)
    return parentDepth === null ? null : parentDepth + 1
  }

  for (const plan of plans.values()) {
    const via = viaOf.get(plan.model)
    if (!via)
      continue
    const parent = plans.get(via)
    if (!parent?.subject) {
      problem(plan.model, `subject { via: '${via}' } points at a model that declares no subject of its own`)
      continue
    }
    const depth = depthOf(plan.model, new Set())
    if (depth === null)
      problem(plan.model, `subject { via: '${via}' } is part of a cycle`)
    else
      plan.depth = depth
  }

  return {
    models: [...plans.values()],
    unclassified: unclassified.sort(),
    problems,
  }
}

/** Throw every declaration problem at once, or return the plan untouched. */
export function assertGdprPlan(plan: GdprPlan): GdprPlan {
  if (plan.problems.length)
    throw new GdprDeclarationError(plan.problems)
  return plan
}
