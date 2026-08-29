/**
 * VSchema generation.
 *
 * A Vitess keyspace needs a VSchema: a document saying, for every table,
 * which column decides the shard and how that column maps to one. Without
 * it vtgate cannot route a query and rejects writes outright.
 *
 * Hand-writing one is where sharding usually goes wrong, and the mistake is
 * always the same shape. Sharding each table by its own `id` looks obviously
 * correct and is quietly the worst option: `users` lands on the shard for
 * `users.id`, `posts` on the shard for `posts.id`, and a join between them
 * has to fan out to every shard in the cluster and merge. The database still
 * answers, so nothing looks broken — it just costs N times more than it
 * should, and the cost grows as shards are added.
 *
 * The fix is to co-locate: a child table shards by the key of its PARENT, so
 * a user and all of their posts live on one shard and the join stays local.
 * That is a fact about the relationship graph, which the models already
 * declare, so this module derives it instead of asking the user to restate
 * it. `belongsTo` is the signal.
 *
 * Derivation, in order:
 *   1. an explicit `traits.sharding` block always wins
 *   2. a model with a `belongsTo` shards by the foreign key to its parent
 *   3. anything else is a root entity and shards by its own `id`
 *
 * Rule 2 is transitive by construction: if `comments` belongs to `posts` and
 * `posts` belongs to `users`, comments shard by `post_id` and posts by
 * `user_id`. That does NOT put a comment on the same shard as its user, and
 * pretending otherwise would need a lookup vindex the user has to design.
 * Sharding here stays one level deep and the report says so, rather than
 * inventing a topology that looks right and is not.
 */

import type { VindexType } from '@stacksjs/types'

/** The subset of a model definition this module needs. */
export interface ShardableModel {
  /** Model name, e.g. `User`. */
  name: string
  /** Table name, e.g. `users`. */
  table: string
  /** Parent model names from `belongsTo`, already normalized to an array. */
  belongsTo: string[]
  /** Whether the model carries `useUuid` (an application-generated key). */
  useUuid: boolean
  /** An explicit sharding declaration, if the model made one. */
  sharding?: {
    column?: string
    vindex?: VindexType
    unsharded?: boolean
    sequence?: string
  }
}

/** A `column_vindexes` entry in the emitted VSchema. */
export interface ColumnVindex {
  column: string
  name: string
}

/** A table entry in the emitted VSchema. */
export interface VSchemaTable {
  column_vindexes?: ColumnVindex[]
  auto_increment?: { column: string, sequence: string }
  type?: 'reference'
}

/** A Vitess keyspace VSchema document. */
export interface VSchema {
  sharded: boolean
  vindexes: Record<string, { type: string }>
  tables: Record<string, VSchemaTable>
}

/** Why a table ended up sharded the way it did, for the CLI report. */
export interface ShardingDecision {
  table: string
  column: string | null
  vindex: VindexType | null
  reason: 'explicit' | 'co-located with parent' | 'root entity' | 'reference table'
  /** The parent table it co-locates with, when reason is co-location. */
  parent?: string
  /** Anything the user should know about this choice. */
  warning?: string
}

export interface VSchemaResult {
  vschema: VSchema
  decisions: ShardingDecision[]
}

/**
 * Convert a model name to its conventional foreign key column.
 *
 * `User` -> `user_id`. Deliberately simple: it mirrors the convention the
 * ORM's own relation resolution uses, and a model that diverges from it can
 * state the column outright in `traits.sharding`.
 */
export function foreignKeyForModel(modelName: string): string {
  const snake = modelName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
  return `${snake}_id`
}

/**
 * Decide how one model shards.
 *
 * Split out from `deriveVSchema` so the decision is testable on its own —
 * it is the part with actual judgement in it, and the part a user will want
 * to reason about when a query turns out to scatter.
 */
export function decideSharding(
  model: ShardableModel,
  tableByModel: Map<string, string>,
): ShardingDecision {
  const declared = model.sharding

  // A reference table is copied to every shard rather than split across
  // them, so it has no vindex at all.
  if (declared?.unsharded) {
    return {
      table: model.table,
      column: null,
      vindex: null,
      reason: 'reference table',
    }
  }

  if (declared?.column) {
    return {
      table: model.table,
      column: declared.column,
      vindex: declared.vindex ?? 'hash',
      reason: 'explicit',
    }
  }

  const parentModel = model.belongsTo[0]
  if (parentModel) {
    const parentTable = tableByModel.get(parentModel)
    return {
      table: model.table,
      column: foreignKeyForModel(parentModel),
      vindex: declared?.vindex ?? 'hash',
      reason: 'co-located with parent',
      parent: parentTable ?? parentModel,
      // Naming more than one parent means only the first can decide the
      // shard; joins through the others still scatter. Better to say so
      // than to pick silently.
      warning: model.belongsTo.length > 1
        ? `belongs to ${model.belongsTo.length} parents; sharded by ${parentModel} only, so joins through ${model.belongsTo.slice(1).join(', ')} will scatter`
        : undefined,
    }
  }

  return {
    table: model.table,
    column: 'id',
    vindex: declared?.vindex ?? 'hash',
    reason: 'root entity',
  }
}

/**
 * Build a keyspace VSchema from model definitions.
 *
 * Returns the decisions alongside the document because the document alone
 * does not explain itself: a user reviewing a generated VSchema needs to
 * know which tables co-locate and which will scatter, and that is exactly
 * what is lost once it is serialized to JSON.
 */
export function deriveVSchema(models: ShardableModel[]): VSchemaResult {
  const tableByModel = new Map(models.map(m => [m.name, m.table]))
  const decisions = models.map(model => decideSharding(model, tableByModel))

  const vindexes: Record<string, { type: string }> = {}
  const tables: Record<string, VSchemaTable> = {}

  for (const [index, decision] of decisions.entries()) {
    const model = models[index] as ShardableModel

    if (decision.reason === 'reference table') {
      tables[decision.table] = { type: 'reference' }
      continue
    }

    const vindexType = decision.vindex ?? 'hash'
    // Vindexes are declared once per type and referenced by name, so
    // hundreds of tables sharing `hash` produce one definition.
    vindexes[vindexType] = { type: vindexType }

    const table: VSchemaTable = {
      column_vindexes: [{ column: decision.column as string, name: vindexType }],
    }

    // A model without `useUuid` still expects a server-generated integer
    // id, which a sharded keyspace cannot provide via AUTO_INCREMENT. Point
    // it at a sequence; the name is derivable, and the sequence table itself
    // lives in an unsharded keyspace the operator creates.
    if (!model.useUuid) {
      table.auto_increment = {
        column: 'id',
        sequence: model.sharding?.sequence ?? `${model.table}_seq`,
      }
    }

    tables[decision.table] = table
  }

  return {
    vschema: { sharded: true, vindexes, tables },
    decisions,
  }
}

/**
 * Normalize a raw model definition into a `ShardableModel`.
 *
 * `belongsTo` accepts several shapes across the codebase (a bare string, an
 * array of names, or an object keyed by model name), so this flattens them
 * to the one form the derivation needs.
 */
export function toShardableModel(
  definition: { name?: string, belongsTo?: unknown, traits?: { useUuid?: unknown, sharding?: ShardableModel['sharding'] } } | null | undefined,
  table: string,
): ShardableModel {
  const raw = definition?.belongsTo
  let belongsTo: string[] = []

  if (typeof raw === 'string')
    belongsTo = [raw]
  else if (Array.isArray(raw))
    belongsTo = raw.map((entry: unknown) => typeof entry === 'string' ? entry : (entry as { model?: string } | null)?.model).filter((entry): entry is string => Boolean(entry))
  else if (raw && typeof raw === 'object')
    belongsTo = Object.keys(raw)

  return {
    name: definition?.name ?? table,
    table,
    belongsTo,
    useUuid: Boolean(definition?.traits?.useUuid),
    sharding: definition?.traits?.sharding,
  }
}

/**
 * Human-readable summary of the sharding decisions.
 *
 * Printed by `buddy generate:vschema` because the whole point of deriving
 * the topology is lost if the user cannot see and challenge it.
 */
export function formatShardingReport(decisions: ShardingDecision[]): string {
  const lines: string[] = []
  const byReason = {
    'explicit': decisions.filter(d => d.reason === 'explicit'),
    'co-located with parent': decisions.filter(d => d.reason === 'co-located with parent'),
    'root entity': decisions.filter(d => d.reason === 'root entity'),
    'reference table': decisions.filter(d => d.reason === 'reference table'),
  }

  if (byReason['root entity'].length) {
    lines.push(`Root entities (sharded by their own id):`)
    for (const d of byReason['root entity'])
      lines.push(`  ${d.table}  ->  ${d.column} (${d.vindex})`)
    lines.push('')
  }

  if (byReason['co-located with parent'].length) {
    lines.push(`Co-located with a parent (joins to that parent stay on one shard):`)
    for (const d of byReason['co-located with parent'])
      lines.push(`  ${d.table}  ->  ${d.column} (${d.vindex}), with ${d.parent}`)
    lines.push('')
  }

  if (byReason.explicit.length) {
    lines.push(`Explicitly declared:`)
    for (const d of byReason.explicit)
      lines.push(`  ${d.table}  ->  ${d.column} (${d.vindex})`)
    lines.push('')
  }

  if (byReason['reference table'].length) {
    lines.push(`Reference tables (copied to every shard):`)
    for (const d of byReason['reference table'])
      lines.push(`  ${d.table}`)
    lines.push('')
  }

  const warnings = decisions.filter(d => d.warning)
  if (warnings.length) {
    lines.push(`Warnings:`)
    for (const d of warnings)
      lines.push(`  ${d.table}: ${d.warning}`)
    lines.push('')
  }

  return lines.join('\n')
}
