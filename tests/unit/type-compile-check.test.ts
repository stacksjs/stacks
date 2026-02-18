/**
 * Type-level compile checks for ORM type narrowing.
 *
 * Since bun doesn't do type checking and tsc has import resolution issues
 * with temp files, we verify type narrowing through structural analysis:
 * - Read the actual TypeScript type definitions
 * - Parse them to verify they produce the correct type constraints
 * - Verify that union types are exhaustive (no `string` escape hatches)
 * - Verify that `never` types are used for empty relation sets
 * - Verify that type files use BaseModelType from @stacksjs/orm
 * - Verify that BaseOrm provides shared static query methods
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const rootDir = resolve(import.meta.dir, '../..')
const typesDir = join(rootDir, 'storage/framework/orm/src/types')
const actionPathsFile = join(rootDir, 'storage/framework/core/router/src/action-paths.ts')

function readTypeFile(name: string): string {
  return readFileSync(join(typesDir, name), 'utf-8')
}

function getActiveTypeFiles(): string[] {
  return readdirSync(typesDir).filter(f => {
    if (!f.endsWith('Type.ts')) return false
    const content = readFileSync(join(typesDir, f), 'utf-8').trim()
    return content.length > 0
  })
}

// ─── Type constraint verification via structural analysis ────────────

describe('type constraints are structurally narrow (no escape hatches)', () => {
  const typeFiles = getActiveTypeFiles()

  test('should have at least 40 active type files', () => {
    expect(typeFiles.length).toBeGreaterThanOrEqual(40)
  })

  describe('no [key: string]: any anywhere', () => {
    for (const file of typeFiles) {
      test(file, () => {
        const content = readTypeFile(file)
        expect(content).not.toContain('[key: string]: any')
        expect(content).not.toContain('[key: string]: unknown')
      })
    }
  })

  describe('no `| string` widening on column/relation types', () => {
    for (const file of typeFiles) {
      test(`${file}: with() does not accept string[]`, () => {
        const content = readTypeFile(file)
        expect(content).not.toContain('with: (relations: string[])')
        expect(content).not.toMatch(/with:\s*\(relations:\s*string\[\]/)
      })

      test(`${file}: orWhere() does not accept [string, any][]`, () => {
        const content = readTypeFile(file)
        expect(content).not.toContain('orWhere: (...conditions: [string, any][])')
      })
    }
  })

  describe('RelationName is a proper union (not string)', () => {
    for (const file of typeFiles) {
      const modelName = file.replace('Type.ts', '')
      test(`${modelName}RelationName is never or a union of string literals`, () => {
        const content = readTypeFile(file)
        const match = content.match(new RegExp(`export type ${modelName}RelationName = (.+)`))
        expect(match).not.toBeNull()
        const typeBody = match![1].trim()

        if (typeBody === 'never') {
          // Valid — no relations
          return
        }

        // Must be a union of string literals like 'author' | 'tags'
        const members = typeBody.split('|').map(m => m.trim())
        for (const member of members) {
          // Each member must be a single-quoted lowercase_snake_case identifier
          expect(member).toMatch(/^'[a-z][a-z0-9_]*'$/)
        }

        // Must NOT be `string`
        expect(typeBody).not.toBe('string')
        expect(typeBody).not.toContain(' string')
      })
    }
  })

  describe('JsonResponse extends Selectable<*Read> with no string index', () => {
    for (const file of typeFiles) {
      const modelName = file.replace('Type.ts', '')
      test(`${modelName}JsonResponse extends Omit<Selectable<*Read>, 'password'>`, () => {
        const content = readTypeFile(file)
        expect(content).toContain(`${modelName}JsonResponse extends Omit<Selectable<${modelName}Read>, 'password'>`)
      })

      test(`${modelName}JsonResponse has no [key: string] index signature`, () => {
        const content = readTypeFile(file)
        // Extract the JsonResponse interface body
        const jsonResponseMatch = content.match(new RegExp(`interface ${modelName}JsonResponse[^{]*{([^}]*)}`, 's'))
        if (jsonResponseMatch) {
          const body = jsonResponseMatch[1]
          expect(body).not.toContain('[key: string]')
          expect(body).not.toContain('[key: string]: any')
        }
      })
    }
  })
})

// ─── StacksActionPath narrowness ─────────────────────────────────────

describe('StacksActionPath is a narrow string literal union', () => {
  const content = readFileSync(actionPathsFile, 'utf-8')
  const allPaths = content.match(/\| '([^']+)'/g)?.map(m => m.replace("| '", '').replace("'", '')) ?? []

  test('is not `string` type', () => {
    expect(content).not.toMatch(/export type StacksActionPath = string\s/)
  })

  test('every member starts with Actions/ or Controllers/', () => {
    for (const p of allPaths) {
      expect(p.startsWith('Actions/') || p.startsWith('Controllers/')).toBe(true)
    }
  })

  test('no member is a generic string or contains whitespace', () => {
    for (const p of allPaths) {
      expect(p).not.toContain(' ')
      expect(p).not.toContain('\t')
      expect(p.length).toBeGreaterThan(10) // minimum path length
    }
  })

  test('action paths use PascalCase for action names', () => {
    for (const p of allPaths) {
      if (p.startsWith('Controllers/')) continue
      const parts = p.split('/')
      const actionName = parts[parts.length - 1]
      // Must start with uppercase (PascalCase)
      expect(actionName[0]).toBe(actionName[0].toUpperCase())
    }
  })

  test('controller paths use Class@method format', () => {
    const controllerPaths = allPaths.filter(p => p.startsWith('Controllers/'))
    for (const p of controllerPaths) {
      const name = p.replace('Controllers/', '')
      expect(name).toContain('@')
      const [className, methodName] = name.split('@')
      expect(className[0]).toBe(className[0].toUpperCase()) // PascalCase class
      expect(methodName[0]).toBe(methodName[0].toLowerCase()) // camelCase method
    }
  })
})

// ─── Cross-reference: relation names match JsonResponse properties ───

describe('relation names match JsonResponse properties', () => {
  test('Post: every PostRelationName has a matching optional property in PostJsonResponse', () => {
    const content = readTypeFile('PostType.ts')
    const relationMatch = content.match(/export type PostRelationName = (.+)/)
    if (!relationMatch || relationMatch[1] === 'never') return

    const names = relationMatch[1].split('|').map(m => m.trim().replace(/'/g, ''))
    const jsonResponseBlock = content.match(/interface PostJsonResponse[^{]*{([\s\S]*?)}/)?.[1] ?? ''

    for (const name of names) {
      // Each relation name should appear as an optional property in JsonResponse
      expect(jsonResponseBlock).toContain(`${name}?:`)
    }
  })

  test('User: every UserRelationName has a matching optional property in UserJsonResponse', () => {
    const content = readTypeFile('UserType.ts')
    const relationMatch = content.match(/export type UserRelationName = (.+)/)
    if (!relationMatch || relationMatch[1] === 'never') return

    const names = relationMatch[1].split('|').map(m => m.trim().replace(/'/g, ''))
    const jsonResponseBlock = content.match(/interface UserJsonResponse[^{]*{([\s\S]*?)}/)?.[1] ?? ''

    for (const name of names) {
      expect(jsonResponseBlock).toContain(`${name}?:`)
    }
  })

  test('Payment: every PaymentRelationName has a matching optional property', () => {
    const content = readTypeFile('PaymentType.ts')
    const relationMatch = content.match(/export type PaymentRelationName = (.+)/)
    if (!relationMatch || relationMatch[1] === 'never') return

    const names = relationMatch[1].split('|').map(m => m.trim().replace(/'/g, ''))
    const jsonResponseBlock = content.match(/interface PaymentJsonResponse[^{]*{([\s\S]*?)}/)?.[1] ?? ''

    for (const name of names) {
      expect(jsonResponseBlock).toContain(`${name}?:`)
    }
  })

  test('all models: RelationName members correspond to JsonResponse properties', () => {
    const typeFiles = getActiveTypeFiles()
    for (const file of typeFiles) {
      const modelName = file.replace('Type.ts', '')
      const content = readTypeFile(file)

      const relationMatch = content.match(new RegExp(`export type ${modelName}RelationName = (.+)`))
      if (!relationMatch || relationMatch[1].trim() === 'never') continue

      const names = relationMatch[1].split('|').map(m => m.trim().replace(/'/g, ''))
      const jsonResponseBlock = content.match(new RegExp(`interface ${modelName}JsonResponse[^{]*{([\\s\\S]*?)}`))?.[1] ?? ''

      for (const name of names) {
        expect(jsonResponseBlock).toContain(`${name}?:`)
      }
    }
  })
})

// ─── Table interface structure ───────────────────────────────────────

describe('Table interfaces are self-contained (no string index)', () => {
  const typeFiles = getActiveTypeFiles()

  for (const file of typeFiles) {
    const modelName = file.replace('Type.ts', '')
    test(`${modelName}: Table has id: Generated<number>`, () => {
      const content = readTypeFile(file)
      expect(content).toContain('id: Generated<number>')
    })
  }
})

// ─── BaseModelType & QueryMethods shared types ──────────────────────

describe('model-types.ts defines shared QueryMethods and BaseModelType', () => {
  const modelTypesFile = join(rootDir, 'storage/framework/core/orm/src/model-types.ts')

  test('model-types.ts exists', () => {
    expect(existsSync(modelTypesFile)).toBe(true)
  })

  test('exports QueryMethods interface', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('export interface QueryMethods<')
  })

  test('exports BaseModelType type', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('export type BaseModelType<')
  })

  test('QueryMethods has all expected type parameters', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('QueryMethods<TTable, TJson, TNew, TUpdate, TRelation extends string, TSelf>')
  })

  test('BaseModelType composes QueryMethods with readonly id', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('QueryMethods<TTable, TJson, TNew, TUpdate, TRelation, TSelf>')
    expect(content).toContain('readonly id: number')
  })

  test('QueryMethods includes select overloads with SelectedQuery', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('select: {')
    expect(content).toMatch(/<K extends keyof TTable & string>\(fields: K\[\]\): SelectedQuery<TTable, TJson, K>/)
    expect(content).toContain('(params: RawBuilder<string> | string): TSelf')
  })

  test('QueryMethods includes where clause methods', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('where: <V = string>(column: keyof TTable, ...args: [V] | [Operator, V]) => TSelf')
    expect(content).toContain('orWhere: (...conditions: [keyof TTable, any][]) => TSelf')
    expect(content).toContain('whereNull: (column: keyof TTable) => TSelf')
    expect(content).toContain('whereNotNull: (column: keyof TTable) => TSelf')
    expect(content).toContain('whereLike: (column: keyof TTable, value: string) => TSelf')
    expect(content).toContain('whereIn: <V = number>(column: keyof TTable, values: V[]) => TSelf')
    expect(content).toContain('whereNotIn: <V = number>(column: keyof TTable, values: V[]) => TSelf')
    expect(content).toContain('whereBetween: <V = number>(column: keyof TTable, range: [V, V]) => TSelf')
    expect(content).toContain('whereColumn: (first: keyof TTable, operator: Operator, second: keyof TTable) => TSelf')
  })

  test('QueryMethods includes ordering and grouping', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('orderBy: (column: keyof TTable, order: \'asc\' | \'desc\') => TSelf')
    expect(content).toContain('groupBy: (column: keyof TTable) => TSelf')
    expect(content).toContain('having: <V = string>(column: keyof TTable, operator: Operator, value: V) => TSelf')
  })

  test('QueryMethods includes aggregate methods returning Promise<number>', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('max: (field: keyof TTable) => Promise<number>')
    expect(content).toContain('min: (field: keyof TTable) => Promise<number>')
    expect(content).toContain('avg: (field: keyof TTable) => Promise<number>')
    expect(content).toContain('sum: (field: keyof TTable) => Promise<number>')
    expect(content).toContain('count: () => Promise<number>')
  })

  test('QueryMethods includes finder methods returning Promise<TSelf>', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('find: (id: number) => Promise<TSelf | undefined>')
    expect(content).toContain('first: () => Promise<TSelf | undefined>')
    expect(content).toContain('last: () => Promise<TSelf | undefined>')
    expect(content).toContain('all: () => Promise<TSelf[]>')
    expect(content).toContain('findOrFail: (id: number) => Promise<TSelf | undefined>')
    expect(content).toContain('findMany: (ids: number[]) => Promise<TSelf[]>')
  })

  test('QueryMethods includes relation loading with TRelation', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('with: (relations: TRelation[]) => TSelf')
  })

  test('QueryMethods includes mutation methods', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('create: (newRecord: TNew) => Promise<TSelf>')
    expect(content).toContain('update: (newRecord: TUpdate) => Promise<TSelf | undefined>')
    expect(content).toContain('save: () => Promise<TSelf>')
    expect(content).toContain('delete: () => Promise<number>')
  })
})

// ─── Type files import BaseModelType (not Operator/SelectedQuery) ────

describe('type files import BaseModelType from @stacksjs/orm', () => {
  const typeFiles = getActiveTypeFiles()

  describe('imports BaseModelType instead of Operator/SelectedQuery', () => {
    for (const file of typeFiles) {
      const modelName = file.replace('Type.ts', '')
      test(`${modelName}: imports BaseModelType from @stacksjs/orm`, () => {
        const content = readTypeFile(file)
        expect(content).toContain("import type { BaseModelType } from '@stacksjs/orm'")
      })

      test(`${modelName}: does NOT import Operator or SelectedQuery directly`, () => {
        const content = readTypeFile(file)
        expect(content).not.toContain("import type { Operator, SelectedQuery } from '@stacksjs/orm'")
        expect(content).not.toContain("import type { Operator } from '@stacksjs/orm'")
        expect(content).not.toContain("import type { SelectedQuery } from '@stacksjs/orm'")
      })
    }
  })
})

// ─── ModelType uses BaseModelType intersection (not interface) ───────

describe('ModelType uses BaseModelType<...> intersection type', () => {
  const typeFiles = getActiveTypeFiles()

  for (const file of typeFiles) {
    const modelName = file.replace('Type.ts', '')

    test(`${modelName}: uses export type *ModelType = BaseModelType<...> & { ... }`, () => {
      const content = readTypeFile(file)
      // Must use type alias with BaseModelType, not interface with inline methods
      expect(content).toMatch(new RegExp(`export type ${modelName}ModelType = BaseModelType<`))
      // Must NOT use the old interface pattern
      expect(content).not.toMatch(new RegExp(`export interface ${modelName}ModelType\\s*\\{`))
    })

    test(`${modelName}: BaseModelType is parameterized with correct types`, () => {
      const content = readTypeFile(file)
      // The BaseModelType should reference Table, JsonResponse, New*, *Update, RelationName, and self
      const baseModelMatch = content.match(new RegExp(`export type ${modelName}ModelType = BaseModelType<([^>]+)>`))
      expect(baseModelMatch).not.toBeNull()

      const params = baseModelMatch![1]
      // Should contain the table type, json response type, and self-reference
      expect(params).toContain('Table')
      expect(params).toContain(`${modelName}JsonResponse`)
      expect(params).toContain(`${modelName}ModelType`)
    })

    test(`${modelName}: does NOT have inline query method signatures`, () => {
      const content = readTypeFile(file)
      // The old pattern had 50+ inline method signatures in the interface.
      // Now those come from BaseModelType. The type should NOT have these inline:
      expect(content).not.toMatch(new RegExp(`${modelName}ModelType[^}]*where: <V = string>\\(column: keyof`))
      expect(content).not.toMatch(new RegExp(`${modelName}ModelType[^}]*orWhere: \\(\\.\\.\\.\\s*conditions:`))
      expect(content).not.toMatch(new RegExp(`${modelName}ModelType[^}]*orderBy: \\(column: keyof`))

      // Should not have the old select overloads inline
      expect(content).not.toMatch(new RegExp(`${modelName}ModelType[^}]*select: \\{[\\s\\S]*?keyof \\w+Table & string`))
    })
  }
})

// ─── Core ORM index exports model-types ──────────────────────────────

describe('core ORM index.ts exports model-types and types', () => {
  const indexFile = join(rootDir, 'storage/framework/core/orm/src/index.ts')

  test('re-exports from ./model-types', () => {
    const content = readFileSync(indexFile, 'utf-8')
    expect(content).toContain("export * from './model-types'")
  })

  test('re-exports from ./types', () => {
    const content = readFileSync(indexFile, 'utf-8')
    expect(content).toContain("export * from './types'")
  })
})

// ─── SelectedQuery / SelectedResult still in core types ──────────────

describe('SelectedQuery and SelectedResult remain in core ORM types', () => {
  const coreTypesFile = join(rootDir, 'storage/framework/core/orm/src/types.ts')

  test('SelectedQuery type is defined in core ORM types', () => {
    const content = readFileSync(coreTypesFile, 'utf-8')
    expect(content).toContain('export interface SelectedQuery<TTable, TJson, K extends string>')
    expect(content).toContain('export type SelectedResult<TJson, K extends string>')
  })

  test('SelectedQuery terminal methods return SelectedResult (narrowed)', () => {
    const content = readFileSync(coreTypesFile, 'utf-8')
    expect(content).toContain('first(): Promise<SelectedResult<TJson, K> | undefined>')
    expect(content).toContain('all(): Promise<SelectedResult<TJson, K>[]>')
    expect(content).toContain('get(): Promise<SelectedResult<TJson, K>[]>')
    expect(content).toContain('find(id: number): Promise<SelectedResult<TJson, K> | undefined>')
    expect(content).toContain('findOrFail(id: number): Promise<SelectedResult<TJson, K>>')
    expect(content).toContain('findMany(ids: number[]): Promise<SelectedResult<TJson, K>[]>')
    expect(content).toContain('last(): Promise<SelectedResult<TJson, K> | undefined>')
    expect(content).toContain('firstOrFail(): Promise<SelectedResult<TJson, K>>')
  })

  test('SelectedQuery chain methods return SelectedQuery (preserving K)', () => {
    const content = readFileSync(coreTypesFile, 'utf-8')
    expect(content).toContain('where<V = string>(column: keyof TTable, ...args: [V] | [Operator, V]): SelectedQuery<TTable, TJson, K>')
    expect(content).toContain('orWhere(...conditions: [keyof TTable, any][]): SelectedQuery<TTable, TJson, K>')
    expect(content).toContain('orderBy(column: keyof TTable, order: \'asc\' | \'desc\'): SelectedQuery<TTable, TJson, K>')
    expect(content).toContain('whereNull(column: keyof TTable): SelectedQuery<TTable, TJson, K>')
    expect(content).toContain('groupBy(column: keyof TTable): SelectedQuery<TTable, TJson, K>')
    expect(content).toContain('skip(count: number): SelectedQuery<TTable, TJson, K>')
    expect(content).toContain('take(count: number): SelectedQuery<TTable, TJson, K>')
  })

  test('SelectedQuery aggregate methods return number (not narrowed)', () => {
    const content = readFileSync(coreTypesFile, 'utf-8')
    expect(content).toContain('max(field: keyof TTable): Promise<number>')
    expect(content).toContain('min(field: keyof TTable): Promise<number>')
    expect(content).toContain('avg(field: keyof TTable): Promise<number>')
    expect(content).toContain('sum(field: keyof TTable): Promise<number>')
    expect(content).toContain('count(): Promise<number>')
  })

  test('SelectedResult is Pick<TJson, K | id> & { id: number }', () => {
    const content = readFileSync(coreTypesFile, 'utf-8')
    expect(content).toContain("Pick<TJson, Extract<K | 'id', keyof TJson>> & { id: number }")
  })
})

// ─── BaseOrm has static query methods ────────────────────────────────

describe('BaseOrm provides static query methods (inherited by all models)', () => {
  const baseOrmFile = join(rootDir, 'storage/framework/orm/src/utils/base.ts')

  test('BaseOrm file exists', () => {
    expect(existsSync(baseOrmFile)).toBe(true)
  })

  test('BaseOrm class is exported', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('export class BaseOrm<')
  })

  test('BaseOrm has static where()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static where(column: any, ...args: any[]): any')
  })

  test('BaseOrm has static find()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static async find(id: number): Promise<any>')
  })

  test('BaseOrm has static first()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static async first(): Promise<any>')
  })

  test('BaseOrm has static last()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static async last(): Promise<any>')
  })

  test('BaseOrm has static all()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static async all(): Promise<any[]>')
  })

  test('BaseOrm has static select()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static select(params: any): any')
  })

  test('BaseOrm has static orderBy()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static orderBy(column: any, order: \'asc\' | \'desc\'): any')
  })

  test('BaseOrm has static groupBy()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static groupBy(column: any): any')
  })

  test('BaseOrm has static whereNull()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static whereNull(column: any): any')
  })

  test('BaseOrm has static whereIn()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static whereIn(column: any, values: any[]): any')
  })

  test('BaseOrm has static findOrFail()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static async findOrFail(id: number): Promise<any>')
  })

  test('BaseOrm has static findMany()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static async findMany(ids: number[]): Promise<any[]>')
  })

  test('BaseOrm has static aggregate methods (max, min, avg, sum, count)', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static async max(field: any): Promise<number>')
    expect(content).toContain('static async min(field: any): Promise<number>')
    expect(content).toContain('static async avg(field: any): Promise<number>')
    expect(content).toContain('static async sum(field: any): Promise<number>')
    expect(content).toContain('static async count(): Promise<number>')
  })

  test('BaseOrm has static paginate()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toMatch(/static async paginate\(/)
  })

  test('BaseOrm has static create()', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toContain('static async create(newRecord: any): Promise<any>')
  })

  test('BaseOrm has instance select() with overloads', () => {
    const content = readFileSync(baseOrmFile, 'utf-8')
    expect(content).toMatch(/select<K extends keyof C & string>\(fields: K\[\]\): SelectedQuery<C, J, K>/)
    expect(content).toContain('select(params: RawBuilder<string> | string): this')
  })
})

// ─── Generated model files extend BaseOrm (no inline static wrappers) ─

describe('generated model files extend BaseOrm', () => {
  const modelsDir = join(rootDir, 'storage/framework/orm/src/models')

  test('Post model extends BaseOrm', () => {
    const content = readFileSync(join(modelsDir, 'Post.ts'), 'utf-8')
    expect(content).toContain('extends BaseOrm<')
    expect(content).toContain("import { BaseOrm } from '../utils/base'")
  })

  test('Post model does NOT import Operator or SelectedQuery directly', () => {
    const content = readFileSync(join(modelsDir, 'Post.ts'), 'utf-8')
    // The model file should not need to import these — BaseOrm handles them
    expect(content).not.toContain("import type { Operator } from '@stacksjs/orm'")
    expect(content).not.toContain("import type { SelectedQuery } from '@stacksjs/orm'")
  })
})
