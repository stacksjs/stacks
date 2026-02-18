/**
 * Type-level compile checks for the zero-generation ORM architecture.
 *
 * Verifies that the type system is structurally correct:
 * - defineModel() return type preserves definition properties
 * - model-types.ts has correct type utilities (ModelRow, NewModelData, etc.)
 * - types.ts SelectedQuery/SelectedResult are properly typed
 * - orm-globals.d.ts declares global types correctly
 * - server-auto-imports.d.ts uses relative paths for models
 * - action.ts uses smart InferRequest for model-aware handlers
 * - request.ts RequestInstance is generic with field narrowing
 * - Model definition files use defineModel with `as const`
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const rootDir = resolve(import.meta.dir, '../..')
const coreOrmDir = join(rootDir, 'storage/framework/core/orm/src')
const typesDir = join(rootDir, 'storage/framework/types')
const frameworkModelsDir = join(rootDir, 'storage/framework/models')
const defaultModelsDir = join(rootDir, 'storage/framework/defaults/models')
const actionFile = join(rootDir, 'storage/framework/core/actions/src/action.ts')
const requestFile = join(rootDir, 'storage/framework/core/types/src/request.ts')
const routerDir = join(rootDir, 'storage/framework/core/router/src')

// ─── Helpers ──────────────────────────────────────────────────────────

function getModelFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => {
    if (!f.endsWith('.ts') || f === 'index.ts' || f.endsWith('.d.ts')) return false
    const content = readFileSync(join(dir, f), 'utf-8').trim()
    return content.length > 0
  })
}

// ─── 1. model-types.ts type utilities ─────────────────────────────────

describe('model-types.ts defines correct type utilities', () => {
  const modelTypesFile = join(coreOrmDir, 'model-types.ts')

  test('model-types.ts exists', () => {
    expect(existsSync(modelTypesFile)).toBe(true)
  })

  test('exports Def type (extracts ModelDefinition from defineModel return)', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('export type Def<T>')
    expect(content).toContain('getDefinition')
    expect(content).toContain('ModelDefinition')
  })

  test('exports BelongsToForeignKeys type', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('export type BelongsToForeignKeys<TDef>')
    // Must derive from belongsTo array
    expect(content).toContain('belongsTo')
    // Must produce _id columns
    expect(content).toContain('_id')
  })

  test('exports ModelRow type (attributes + FK columns)', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('export type ModelRow<T>')
    // Must compose ModelAttributes and BelongsToForeignKeys
    expect(content).toContain('ModelAttributes')
    expect(content).toContain('BelongsToForeignKeys')
  })

  test('exports NewModelData type (all optional)', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('export type NewModelData<T>')
    expect(content).toContain('Partial<')
  })

  test('exports UpdateModelData type (all optional)', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain('export type UpdateModelData<T>')
    expect(content).toContain('Partial<')
  })

  test('imports from bun-query-builder (not generated types)', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).toContain("from 'bun-query-builder'")
    expect(content).toContain('InferModelAttributes')
    expect(content).toContain('ModelAttributes')
    expect(content).toContain('ModelDefinition')
  })

  test('does NOT reference generated type files', () => {
    const content = readFileSync(modelTypesFile, 'utf-8')
    expect(content).not.toContain('PostType')
    expect(content).not.toContain('UserType')
    expect(content).not.toContain('orm/src/types')
    expect(content).not.toContain('BaseOrm')
    expect(content).not.toContain('BaseModelType')
  })
})

// ─── 2. types.ts SelectedQuery/SelectedResult ─────────────────────────

describe('types.ts defines SelectedQuery and SelectedResult', () => {
  const typesFile = join(coreOrmDir, 'types.ts')

  test('types.ts exists', () => {
    expect(existsSync(typesFile)).toBe(true)
  })

  test('SelectedQuery interface uses keyof TTable for column narrowing', () => {
    const content = readFileSync(typesFile, 'utf-8')
    expect(content).toContain('export interface SelectedQuery<TTable, TJson, K extends string>')
    // Chain methods use keyof TTable
    expect(content).toContain('where<V = string>(column: keyof TTable')
    expect(content).toContain('orderBy(column: keyof TTable')
    expect(content).toContain('whereNull(column: keyof TTable)')
    expect(content).toContain('groupBy(column: keyof TTable)')
  })

  test('SelectedQuery terminal methods return SelectedResult (narrowed)', () => {
    const content = readFileSync(typesFile, 'utf-8')
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
    const content = readFileSync(typesFile, 'utf-8')
    expect(content).toContain('): SelectedQuery<TTable, TJson, K>')
  })

  test('SelectedQuery aggregate methods return Promise<number>', () => {
    const content = readFileSync(typesFile, 'utf-8')
    expect(content).toContain('max(field: keyof TTable): Promise<number>')
    expect(content).toContain('min(field: keyof TTable): Promise<number>')
    expect(content).toContain('avg(field: keyof TTable): Promise<number>')
    expect(content).toContain('sum(field: keyof TTable): Promise<number>')
    expect(content).toContain('count(): Promise<number>')
  })

  test('SelectedResult is Pick<TJson, K | id>', () => {
    const content = readFileSync(typesFile, 'utf-8')
    expect(content).toContain("Pick<TJson, Extract<K | 'id', keyof TJson>> & { id: number }")
  })

  test('does NOT contain [key: string]: any', () => {
    const content = readFileSync(typesFile, 'utf-8')
    expect(content).not.toContain('[key: string]: any')
  })
})

// ─── 3. define-model.ts exports and structure ─────────────────────────

describe('define-model.ts exports defineModel and type re-exports', () => {
  const defineModelFile = join(coreOrmDir, 'define-model.ts')

  test('define-model.ts exists', () => {
    expect(existsSync(defineModelFile)).toBe(true)
  })

  test('exports defineModel function', () => {
    const content = readFileSync(defineModelFile, 'utf-8')
    expect(content).toContain('export function defineModel')
  })

  test('defineModel uses const generic for literal type preservation', () => {
    const content = readFileSync(defineModelFile, 'utf-8')
    expect(content).toContain('<const TDef extends ModelDefinition>')
  })

  test('defineModel adds _isStacksModel flag', () => {
    const content = readFileSync(defineModelFile, 'utf-8')
    expect(content).toContain('_isStacksModel: true as const')
  })

  test('defineModel adds getDefinition accessor', () => {
    const content = readFileSync(defineModelFile, 'utf-8')
    expect(content).toContain('getDefinition: () => definition')
  })

  test('re-exports type utilities from bun-query-builder', () => {
    const content = readFileSync(defineModelFile, 'utf-8')
    expect(content).toContain("from 'bun-query-builder'")
    expect(content).toContain('ModelDefinition')
    expect(content).toContain('InferRelationNames')
    expect(content).toContain('ModelAttributes')
    expect(content).toContain('InferModelAttributes')
    expect(content).toContain('ColumnName')
    expect(content).toContain('AttributeKeys')
    expect(content).toContain('FillableKeys')
    expect(content).toContain('HiddenKeys')
  })

  test('imports createModel from bun-query-builder', () => {
    const content = readFileSync(defineModelFile, 'utf-8')
    expect(content).toContain("import { createModel")
    expect(content).toContain("from 'bun-query-builder'")
  })

  test('does NOT reference generated files or BaseOrm', () => {
    const content = readFileSync(defineModelFile, 'utf-8')
    expect(content).not.toContain('BaseOrm')
    expect(content).not.toContain('orm/src/models')
    expect(content).not.toContain('orm/src/types')
    expect(content).not.toContain('generate')
  })
})

// ─── 4. ORM index.ts barrel exports ───────────────────────────────────

describe('core ORM index.ts exports all necessary modules', () => {
  const indexFile = join(coreOrmDir, 'index.ts')

  test('re-exports from ./model-types', () => {
    const content = readFileSync(indexFile, 'utf-8')
    expect(content).toContain("from './model-types'")
  })

  test('re-exports from ./types', () => {
    const content = readFileSync(indexFile, 'utf-8')
    expect(content).toContain("from './types'")
  })

  test('re-exports from ./define-model', () => {
    const content = readFileSync(indexFile, 'utf-8')
    expect(content).toContain("from './define-model'")
  })

  test('re-exports type utilities from bun-query-builder', () => {
    const content = readFileSync(indexFile, 'utf-8')
    expect(content).toContain("from 'bun-query-builder'")
  })
})

// ─── 5. orm-globals.d.ts declares global types ────────────────────────

describe('orm-globals.d.ts declares global type aliases', () => {
  const globalsFile = join(typesDir, 'orm-globals.d.ts')

  test('orm-globals.d.ts exists', () => {
    expect(existsSync(globalsFile)).toBe(true)
  })

  test('declares global ModelRow type', () => {
    const content = readFileSync(globalsFile, 'utf-8')
    expect(content).toContain('type ModelRow<T>')
  })

  test('declares global NewModelData type', () => {
    const content = readFileSync(globalsFile, 'utf-8')
    expect(content).toContain('type NewModelData<T>')
  })

  test('declares global UpdateModelData type', () => {
    const content = readFileSync(globalsFile, 'utf-8')
    expect(content).toContain('type UpdateModelData<T>')
  })

  test('declares global RequestInstance type', () => {
    const content = readFileSync(globalsFile, 'utf-8')
    expect(content).toContain('type RequestInstance<')
  })

  test('uses declare global block', () => {
    const content = readFileSync(globalsFile, 'utf-8')
    expect(content).toContain('declare global')
  })

  test('imports from @stacksjs/orm and @stacksjs/types', () => {
    const content = readFileSync(globalsFile, 'utf-8')
    expect(content).toContain("from '@stacksjs/orm'")
    expect(content).toContain("from '@stacksjs/types'")
  })

  test('RequestInstance resolves to model-aware type when TModel provided', () => {
    const content = readFileSync(globalsFile, 'utf-8')
    // The global type should map TModel to _RequestInstance<_ModelRow<TModel>>
    expect(content).toContain('_RequestInstance<_ModelRow<TModel>>')
  })

  test('does NOT contain [key: string]: any', () => {
    const content = readFileSync(globalsFile, 'utf-8')
    expect(content).not.toContain('[key: string]: any')
  })
})

// ─── 6. server-auto-imports.d.ts model declarations ───────────────────

describe('server-auto-imports.d.ts has model declarations with relative paths', () => {
  const autoImportsFile = join(typesDir, 'server-auto-imports.d.ts')

  test('server-auto-imports.d.ts exists', () => {
    expect(existsSync(autoImportsFile)).toBe(true)
  })

  test('uses declare global block', () => {
    const content = readFileSync(autoImportsFile, 'utf-8')
    expect(content).toContain('declare global')
  })

  test('declares Post model as global const', () => {
    const content = readFileSync(autoImportsFile, 'utf-8')
    expect(content).toMatch(/const Post:\s*typeof import\(/)
  })

  test('declares User model as global const', () => {
    const content = readFileSync(autoImportsFile, 'utf-8')
    expect(content).toMatch(/const User:\s*typeof import\(/)
  })

  test('uses relative paths (not absolute)', () => {
    const content = readFileSync(autoImportsFile, 'utf-8')
    // Should use relative paths like '../models/Post'
    expect(content).not.toContain('/Users/')
    expect(content).not.toContain('C:\\')
    // All import paths should start with '..'
    const importPaths = content.match(/import\('([^']+)'\)/g) || []
    for (const importPath of importPaths) {
      const path = importPath.match(/import\('([^']+)'\)/)?.[1]
      expect(path).toMatch(/^\.\./)
    }
  })

  test('references default export from model files', () => {
    const content = readFileSync(autoImportsFile, 'utf-8')
    expect(content).toContain("['default']")
  })

  test('has at least 40 model declarations', () => {
    const content = readFileSync(autoImportsFile, 'utf-8')
    const declarations = content.match(/const \w+:\s*typeof import/g) || []
    expect(declarations.length).toBeGreaterThanOrEqual(40)
  })

  test('does NOT contain ModelRegistry', () => {
    const content = readFileSync(autoImportsFile, 'utf-8')
    expect(content).not.toContain('ModelRegistry')
  })
})

// ─── 7. Action class smart type inference ─────────────────────────────

describe('Action class uses smart InferRequest for model-aware handlers', () => {
  test('action.ts exists', () => {
    expect(existsSync(actionFile)).toBe(true)
  })

  test('defines InferRequest type that uses _isStacksModel discriminator', () => {
    const content = readFileSync(actionFile, 'utf-8')
    expect(content).toContain('InferRequest<TModel>')
    expect(content).toContain('_isStacksModel')
    expect(content).toContain('RequestInstance<TModel>')
    expect(content).toContain('RequestInstance')
  })

  test('Action class is generic over TModel', () => {
    const content = readFileSync(actionFile, 'utf-8')
    expect(content).toContain('class Action<TModel')
  })

  test('handle method uses InferRequest<TModel> for request type', () => {
    const content = readFileSync(actionFile, 'utf-8')
    expect(content).toContain('handle: (request: InferRequest<TModel>)')
  })

  test('model property is stored as string for runtime', () => {
    const content = readFileSync(actionFile, 'utf-8')
    expect(content).toContain('model?: string')
  })

  test('constructor extracts model name from object reference', () => {
    const content = readFileSync(actionFile, 'utf-8')
    // When model is an object with a name property, extract the name string
    expect(content).toContain("'name' in model")
    expect(content).toContain('(model as any).name')
  })

  test('does NOT import ModelRegistry', () => {
    const content = readFileSync(actionFile, 'utf-8')
    expect(content).not.toContain('ModelRegistry')
  })

  test('does NOT use string-to-type mapping', () => {
    const content = readFileSync(actionFile, 'utf-8')
    // Should not have any pattern like TModelName extends keyof SomeRegistry
    expect(content).not.toContain('keyof ModelRegistry')
    expect(content).not.toContain('extends keyof')
  })
})

// ─── 8. RequestInstance is generic with field narrowing ────────────────

describe('RequestInstance<TFields> is generic with model-aware narrowing', () => {
  test('request.ts exists', () => {
    expect(existsSync(requestFile)).toBe(true)
  })

  test('RequestInstance has TFields generic parameter', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('interface RequestInstance<TFields extends Record<string, any>')
  })

  test('TFields defaults to Record<string, any> for backward compatibility', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('= Record<string, any>>')
  })

  test('get() method narrows key to keyof TFields', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('get: <K extends keyof TFields & string>(key: K')
  })

  test('input() method narrows key to keyof TFields', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('input: <K extends keyof TFields & string>(key: K')
  })

  test('only() method returns Pick<TFields, K>', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('only: <K extends keyof TFields & string>(keys: K[]) => Pick<TFields, K>')
  })

  test('except() method returns Omit<TFields, K>', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('except: <K extends keyof TFields & string>(keys: K[]) => Omit<TFields, K>')
  })

  test('validate() returns Promise<TFields>', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('validate: (rules?: Record<string, string>, messages?: Record<string, string>) => Promise<TFields>')
  })

  test('all() returns TFields', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('all: () => TFields')
  })

  test('has() narrows keys to keyof TFields', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('has: (key: (keyof TFields & string) | (keyof TFields & string)[]) => boolean')
  })

  test('safe() returns SafeData<TFields>', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('safe: () => SafeData<TFields>')
  })

  test('keys() returns model field names', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('keys: () => (keyof TFields & string)[]')
  })

  test('type-casting methods narrow keys to keyof TFields', () => {
    const content = readFileSync(requestFile, 'utf-8')
    expect(content).toContain('string: (key: keyof TFields & string')
    expect(content).toContain('integer: (key: keyof TFields & string')
    expect(content).toContain('float: (key: keyof TFields & string')
    expect(content).toContain('boolean: (key: keyof TFields & string')
  })

  test('file methods are NOT narrowed (independent of model)', () => {
    const content = readFileSync(requestFile, 'utf-8')
    // File methods use plain string, not keyof TFields
    expect(content).toContain('file: (key: string)')
    expect(content).toContain('hasFile: (key: string)')
  })
})

// ─── 9. Model definition files use defineModel with as const ──────────

describe('model definition files use defineModel pattern', () => {
  const frameworkModels = getModelFiles(frameworkModelsDir)
  const defaultModels = getModelFiles(defaultModelsDir)
  const allModels = [
    ...frameworkModels.map(f => ({ file: f, dir: frameworkModelsDir })),
    ...defaultModels.map(f => ({ file: f, dir: defaultModelsDir })),
  ]

  test('should have model files in framework/models or defaults/models', () => {
    expect(allModels.length).toBeGreaterThan(30)
  })

  for (const { file, dir } of allModels) {
    const modelName = file.replace('.ts', '')

    test(`${modelName}: uses defineModel()`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).toContain('defineModel(')
    })

    test(`${modelName}: uses 'as const' for literal type preservation`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).toContain('as const)')
    })

    test(`${modelName}: is a default export`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).toContain('export default defineModel(')
    })

    test(`${modelName}: has name property`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).toMatch(/name:\s*'/)
    })

    test(`${modelName}: has table property`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).toMatch(/table:\s*'/)
    })

    test(`${modelName}: has attributes object`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).toContain('attributes:')
    })

    test(`${modelName}: does NOT use 'satisfies Model' pattern`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).not.toContain('satisfies Model')
    })
  }
})

// ─── 10. No generated type files or model classes exist ───────────────

describe('old generated files are removed', () => {
  const oldTypesDir = join(rootDir, 'storage/framework/orm/src/types')
  const oldModelsDir = join(rootDir, 'storage/framework/orm/src/models')
  const oldBaseOrm = join(rootDir, 'storage/framework/orm/src/utils/base.ts')
  const oldGenerator = join(rootDir, 'storage/framework/core/orm/src/generate.ts')

  test('generated types directory does not exist', () => {
    expect(existsSync(oldTypesDir)).toBe(false)
  })

  test('generated models directory does not exist', () => {
    expect(existsSync(oldModelsDir)).toBe(false)
  })

  test('BaseOrm file does not exist', () => {
    expect(existsSync(oldBaseOrm)).toBe(false)
  })

  test('generator file does not exist', () => {
    expect(existsSync(oldGenerator)).toBe(false)
  })
})

// ─── 11. Stacks router uses StacksActionPath (not plain string) ───────

describe('stacks-router uses StacksActionPath type', () => {
  const routerFile = join(routerDir, 'stacks-router.ts')

  test('stacks-router.ts exists', () => {
    expect(existsSync(routerFile)).toBe(true)
  })

  test('imports StacksActionPath from action-paths', () => {
    const content = readFileSync(routerFile, 'utf-8')
    expect(content).toContain("import type { StacksActionPath } from './action-paths'")
  })

  test('StacksHandler uses StacksActionPath (not string)', () => {
    const content = readFileSync(routerFile, 'utf-8')
    expect(content).toContain('type StacksHandler = ActionHandler | StacksActionPath')
  })

  test('does NOT use StringHandler = string', () => {
    const content = readFileSync(routerFile, 'utf-8')
    expect(content).not.toContain('type StringHandler = string')
  })
})
