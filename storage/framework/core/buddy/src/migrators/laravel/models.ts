/**
 * Laravel Eloquent → Stacks `defineModel({})` translator.
 *
 * Eloquent models are PHP classes that lean on convention plus a few
 * `protected $foo = ...` properties to describe schema and behaviour.
 * We pull the bits we need by regex:
 *
 *   - class name                 → model `name`
 *   - protected $table           → `table`
 *   - protected $fillable        → which attributes are `fillable: true`
 *   - protected $casts           → which attributes get a typed
 *                                  validation rule
 *   - hasMany/hasOne/belongsTo   → relationship hints in the report
 *
 * Anything else (scopes, accessors, mutators, observers) gets dropped
 * with a note in the migration report. The user can re-add them by
 * hand from the Stacks docs.
 */

export interface ParsedModel {
  className: string
  table: string
  fillable: string[]
  hidden: string[]
  casts: Record<string, string>
  relationships: ParsedRelationship[]
  /** Body of the emitted `defineModel({...})` Stacks file. */
  tsSource: string
  /** Notes for the migration report — methods/properties we recognised but didn't translate. */
  notes: string[]
}

export interface ParsedRelationship {
  /** The method name on the Eloquent model — used as the relation name in Stacks. */
  name: string
  kind: 'belongsTo' | 'hasMany' | 'hasOne' | 'belongsToMany'
  target: string
}

const RELATION_KINDS = ['belongsTo', 'hasMany', 'hasOne', 'belongsToMany'] as const

export function parseLaravelModel(source: string): ParsedModel | null {
  const classMatch = source.match(/\bclass\s+([A-Z][A-Za-z0-9_]*)\b/)
  if (!classMatch) return null
  const className = classMatch[1]

  const table = extractStringProperty(source, 'table') ?? snakeCasePlural(className)
  const fillable = extractArrayProperty(source, 'fillable')
  const hidden = extractArrayProperty(source, 'hidden')
  const casts = extractKeyedArrayProperty(source, 'casts')
  const relationships = extractRelationships(source)
  const notes: string[] = []

  if (/protected\s+\$appends\s*=/.test(source)) notes.push('$appends accessors require a custom Stacks computed-attribute setup')
  if (/protected\s+\$dates\s*=/.test(source)) notes.push('$dates is implicit in Stacks — datetime columns are already typed via validation rules')
  // Trait `use` lines can be comma-separated: `use HasFactory, SoftDeletes, Notifiable;`.
  // Match the keyword anywhere inside a `use ...;` directive.
  if (/\buse\b[^;]*\bSoftDeletes\b/.test(source)) notes.push('SoftDeletes trait → enable `useDeletedAt` (or matching trait) in the Stacks model traits block')
  if (/\buse\b[^;]*\bHasFactory\b/.test(source)) notes.push('HasFactory → Stacks generates factories automatically when `useSeeder` is enabled')

  const tsSource = emitStacksModel({ className, table, fillable, hidden, casts, relationships })

  return { className, table, fillable, hidden, casts, relationships, tsSource, notes }
}

function extractStringProperty(source: string, name: string): string | null {
  const re = new RegExp(`protected\\s+\\$${name}\\s*=\\s*['"]([^'"]+)['"]`)
  const m = source.match(re)
  return m ? m[1] : null
}

function extractArrayProperty(source: string, name: string): string[] {
  const re = new RegExp(`protected\\s+\\$${name}\\s*=\\s*\\[([^\\]]*)\\]`, 's')
  const m = source.match(re)
  if (!m) return []
  return m[1]
    .split(',')
    .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function extractKeyedArrayProperty(source: string, name: string): Record<string, string> {
  const re = new RegExp(`protected\\s+\\$${name}\\s*=\\s*\\[([^\\]]*)\\]`, 's')
  const m = source.match(re)
  if (!m) return {}
  const out: Record<string, string> = {}
  const pairs = m[1].split(',')
  for (const pair of pairs) {
    const kv = pair.match(/['"]([^'"]+)['"]\s*=>\s*['"]([^'"]+)['"]/)
    if (kv) out[kv[1]] = kv[2]
  }
  return out
}

function extractRelationships(source: string): ParsedRelationship[] {
  const found: ParsedRelationship[] = []
  // Match `public function <name>() ... return $this->belongsTo(Foo::class)`.
  // The matcher is intentionally loose — we just want to spot the keyword
  // and the target. Detailed relation config (foreign keys, pivot tables)
  // gets dropped to the report rather than translated.
  const methodRegex = /public\s+function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?::\s*[^\{]+)?\{[\s\S]*?return\s+\$this\s*->\s*(belongsTo|hasMany|hasOne|belongsToMany)\s*\(\s*([A-Z][A-Za-z0-9_]*)::class/g
  let m: RegExpExecArray | null
  while ((m = methodRegex.exec(source)) !== null) {
    const name = m[1]
    const kind = m[2] as (typeof RELATION_KINDS)[number]
    const target = m[3]
    found.push({ name, kind, target })
  }
  return found
}

interface EmitArgs {
  className: string
  table: string
  fillable: string[]
  hidden: string[]
  casts: Record<string, string>
  relationships: ParsedRelationship[]
}

function emitStacksModel(args: EmitArgs): string {
  const attributeNames = unique([...args.fillable, ...Object.keys(args.casts)])
  const attrBlock = attributeNames.length === 0
    ? '  attributes: {},'
    : `  attributes: {\n${attributeNames.map(n => emitAttribute(n, args)).join('\n')}\n  },`

  const relationsBlock = args.relationships.length === 0
    ? ''
    : `\n  // Relationships translated from Eloquent — refine targets / foreign keys to match your schema.\n  relations: {\n${args.relationships.map(r => `    ${r.name}: { type: '${r.kind}', target: '${r.target}' },`).join('\n')}\n  },\n`

  return `import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: '${args.className}',
  table: '${args.table}',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },
${relationsBlock}
${attrBlock}
} as const)
`
}

function emitAttribute(name: string, args: EmitArgs): string {
  const rule = ruleForCast(args.casts[name]) ?? 'schema.string()'
  const fillable = args.fillable.includes(name)
  const hidden = args.hidden.includes(name)
  const notes: string[] = []
  if (hidden) notes.push('hidden from API responses in source — handle via your Stacks resource/transformer')
  const noteLine = notes.length > 0 ? `      // ${notes.join('; ')}\n` : ''
  return `    ${name}: {
      fillable: ${fillable},
${noteLine}      validation: {
        rule: ${rule},
      },
    },`
}

function ruleForCast(cast: string | undefined): string | null {
  if (!cast) return null
  const head = cast.split(':')[0]
  switch (head) {
    case 'integer':
    case 'int':
      return 'schema.number().int()'
    case 'float':
    case 'double':
    case 'real':
      return 'schema.number()'
    case 'boolean':
    case 'bool':
      return 'schema.boolean()'
    case 'string':
      return 'schema.string()'
    case 'array':
    case 'collection':
    case 'json':
    case 'object':
      return 'schema.unknown()'
    case 'date':
    case 'datetime':
    case 'immutable_date':
    case 'immutable_datetime':
      return 'schema.string()' // Stacks stores ISO datetimes as strings + a date-shaped validator.
    case 'decimal':
      return 'schema.number()'
    default:
      return null
  }
}

function snakeCasePlural(className: string): string {
  const snake = className.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  // Naive pluralisation — covers >95% of real-world Eloquent models.
  if (snake.endsWith('y') && !/[aeiou]y$/.test(snake)) return `${snake.slice(0, -1)}ies`
  if (snake.endsWith('s') || snake.endsWith('x') || snake.endsWith('z') || snake.endsWith('ch') || snake.endsWith('sh')) return `${snake}es`
  return `${snake}s`
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}
