/**
 * Type narrowing verification for the zero-generation ORM.
 *
 * Since bun doesn't do type checking at test time, we verify type narrowing
 * through structural analysis of the source files:
 * - defineModel() definitions have narrow literal types via `as const`
 * - RequestInstance<TFields> narrows all input methods
 * - Action class smart inference from model property
 * - ModelRow/NewModelData/UpdateModelData derive from definitions
 * - No wide `any` escape hatches in core type utilities
 * - Consumer files use properly typed patterns
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const rootDir = resolve(import.meta.dir, '../..')
const coreOrmDir = join(rootDir, 'storage/framework/core/orm/src')
const typesDir = join(rootDir, 'storage/framework/types')
const frameworkModelsDir = join(rootDir, 'storage/framework/models')
const defaultModelsDir = join(rootDir, 'storage/framework/defaults/models')
const cmsDir = join(rootDir, 'storage/framework/core/cms/src')
const commerceDir = join(rootDir, 'storage/framework/core/commerce/src')
const defaultActionsDir = join(rootDir, 'storage/framework/defaults/app/Actions')

// ─── Helpers ──────────────────────────────────────────────────────────

function getModelFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => {
    if (!f.endsWith('.ts') || f === 'index.ts' || f.endsWith('.d.ts')) return false
    const content = readFileSync(join(dir, f), 'utf-8').trim()
    return content.length > 0
  })
}

function getAllModelNames(): string[] {
  const fw = getModelFiles(frameworkModelsDir).map(f => f.replace('.ts', ''))
  const def = getModelFiles(defaultModelsDir).map(f => f.replace('.ts', ''))
  return [...new Set([...fw, ...def])]
}

// ─── 1. defineModel definitions have narrow types ─────────────────────

describe('defineModel definitions preserve literal types via as const', () => {
  test('Post model has narrow attribute keys', () => {
    const content = readFileSync(join(frameworkModelsDir, 'Post.ts'), 'utf-8')
    // Should contain specific attribute names as object keys
    expect(content).toContain('title:')
    expect(content).toContain('content:')
    expect(content).toContain('views:')
    expect(content).toContain('status:')
    // Should use as const for literal preservation
    expect(content).toContain('as const)')
  })

  test('Post model has narrow belongsTo relation', () => {
    const content = readFileSync(join(frameworkModelsDir, 'Post.ts'), 'utf-8')
    expect(content).toContain("belongsTo: ['Author']")
  })

  test('User model has narrow attribute keys', () => {
    const content = readFileSync(join(frameworkModelsDir, 'User.ts'), 'utf-8')
    expect(content).toContain('name:')
    expect(content).toContain('email:')
    expect(content).toContain('password:')
    expect(content).toContain('as const)')
  })

  test('all model files have name and table as string literals', () => {
    const allModels = [
      ...getModelFiles(frameworkModelsDir).map(f => ({ file: f, dir: frameworkModelsDir })),
      ...getModelFiles(defaultModelsDir).map(f => ({ file: f, dir: defaultModelsDir })),
    ]

    for (const { file, dir } of allModels) {
      const content = readFileSync(join(dir, file), 'utf-8')
      // name should be a string literal like name: 'Post'
      expect(content).toMatch(/name:\s*'[A-Z]/)
      // table should be a string literal like table: 'posts'
      expect(content).toMatch(/table:\s*'[a-z]/)
    }
  })
})

// ─── 2. Model files do NOT import generated types ─────────────────────

describe('model files are self-contained (no generated type imports)', () => {
  const allModels = [
    ...getModelFiles(frameworkModelsDir).map(f => ({ file: f, dir: frameworkModelsDir })),
    ...getModelFiles(defaultModelsDir).map(f => ({ file: f, dir: defaultModelsDir })),
  ]

  for (const { file, dir } of allModels) {
    const modelName = file.replace('.ts', '')

    test(`${modelName}: imports defineModel from @stacksjs/orm`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).toContain("import { defineModel } from '@stacksjs/orm'")
    })

    test(`${modelName}: does NOT import from orm/src/types`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).not.toContain('orm/src/types')
    })

    test(`${modelName}: does NOT import from orm/src/models`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).not.toContain('orm/src/models')
    })

    test(`${modelName}: does NOT import BaseOrm`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).not.toContain('BaseOrm')
    })

    test(`${modelName}: does NOT use satisfies Model`, () => {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content).not.toContain('satisfies Model')
    })
  }
})

// ─── 3. RequestInstance narrowing structure ────────────────────────────

describe('RequestInstance<TFields> narrowing structure', () => {
  const requestFile = join(rootDir, 'storage/framework/core/types/src/request.ts')
  const content = readFileSync(requestFile, 'utf-8')

  test('all input methods use keyof TFields & string (not plain string)', () => {
    // Count occurrences of narrowed vs wide patterns
    const narrowedPatterns = (content.match(/keyof TFields & string/g) || []).length
    expect(narrowedPatterns).toBeGreaterThanOrEqual(15) // get, input, only, except, has, hasAny, filled, missing, merge, keys, string, integer, float, boolean, etc.
  })

  test('get() return type is TFields[K] (not any)', () => {
    expect(content).toContain('(key: K, defaultValue?: TFields[K]) => TFields[K]')
  })

  test('validate() return type is TFields (not any)', () => {
    expect(content).toContain('=> Promise<TFields>')
  })

  test('getValidated() return type is TFields (not any)', () => {
    expect(content).toContain('getValidated: () => TFields')
  })

  test('merge() accepts Partial<TFields> (not Record<string, any>)', () => {
    expect(content).toContain('merge: (data: Partial<TFields>) => void')
  })

  test('SafeData interface narrows to TFields', () => {
    expect(content).toContain('interface SafeData<T extends Record<string, any>')
    expect(content).toContain('only: <K extends keyof T>(keys: K[]) => Pick<T, K>')
    expect(content).toContain('get: <K extends keyof T>(key: K) => T[K]')
  })
})

// ─── 4. Action class smart model inference ────────────────────────────

describe('Action class InferRequest type resolution', () => {
  const actionFile = join(rootDir, 'storage/framework/core/actions/src/action.ts')
  const content = readFileSync(actionFile, 'utf-8')

  test('InferRequest resolves RequestInstance<TModel> when _isStacksModel is true', () => {
    // Pattern: TModel extends { _isStacksModel: true } ? RequestInstance<TModel> : RequestInstance
    expect(content).toContain("TModel extends { _isStacksModel: true }")
    expect(content).toContain('? RequestInstance<TModel>')
    expect(content).toContain(': RequestInstance')
  })

  test('ActionOptions model property accepts object references', () => {
    // model should be TModel, not just string
    expect(content).toContain('model?: TModel')
  })

  test('Action handle uses InferRequest', () => {
    expect(content).toContain('handle: (request: InferRequest<TModel>)')
  })

  test('falls back to bare RequestInstance when model is a string', () => {
    // Default TModel = string, which doesn't have _isStacksModel
    expect(content).toMatch(/class Action<TModel = string>/)
  })
})

// ─── 5. Consumer files use ModelRow<typeof Model> pattern ─────────────

describe('CMS consumer files use ModelRow<typeof Model> pattern', () => {
  const postsFetchFile = join(cmsDir, 'posts/fetch.ts')
  const authorsFetchFile = join(cmsDir, 'authors/fetch.ts')

  if (existsSync(postsFetchFile)) {
    test('posts/fetch.ts uses ModelRow<typeof Post>', () => {
      const content = readFileSync(postsFetchFile, 'utf-8')
      expect(content).toContain('ModelRow<typeof Post>')
      // Should NOT import ModelRow (it's global)
      expect(content).not.toContain("import type { ModelRow }")
    })
  }

  if (existsSync(authorsFetchFile)) {
    test('authors/fetch.ts uses ModelRow<typeof Author>', () => {
      const content = readFileSync(authorsFetchFile, 'utf-8')
      expect(content).toContain('ModelRow<typeof Author>')
    })
  }
})

describe('Commerce consumer files use ModelRow<typeof Model> pattern', () => {
  const categoriesFetchFile = join(commerceDir, 'products/categories/fetch.ts')

  if (existsSync(categoriesFetchFile)) {
    test('categories/fetch.ts uses ModelRow<typeof Category>', () => {
      const content = readFileSync(categoriesFetchFile, 'utf-8')
      expect(content).toContain('ModelRow<typeof Category>')
    })
  }
})

// ─── 6. No wide any in core type utilities ────────────────────────────

describe('core type utilities avoid unnecessary any', () => {
  test('model-types.ts has no any escape hatches', () => {
    const content = readFileSync(join(coreOrmDir, 'model-types.ts'), 'utf-8')
    // model-types.ts should be fully typed with no `any`
    expect(content).not.toContain(': any')
    expect(content).not.toContain('as any')
  })

  test('define-model.ts _isStacksModel is true as const (not boolean)', () => {
    const content = readFileSync(join(coreOrmDir, 'define-model.ts'), 'utf-8')
    expect(content).toContain('_isStacksModel: true as const')
    // Should NOT be just `_isStacksModel: true` without as const
    // (as const preserves the literal type for discriminant narrowing)
  })

  test('orm-globals.d.ts has no any escape hatches', () => {
    const content = readFileSync(join(typesDir, 'orm-globals.d.ts'), 'utf-8')
    expect(content).not.toContain(': any')
    expect(content).not.toContain('as any')
  })
})

// ─── 7. Action files use model: ModelObject (not string) ──────────────

describe('action files with model property use object references', () => {
  // Check default action files that have model property
  if (existsSync(defaultActionsDir)) {
    const actionSubdirs = ['Cms', 'Commerce']
    for (const subdir of actionSubdirs) {
      const dir = join(defaultActionsDir, subdir)
      if (!existsSync(dir)) continue

      const files = readdirSync(dir).filter(f => f.endsWith('.ts'))
      for (const file of files) {
        const content = readFileSync(join(dir, file), 'utf-8')
        // If file has model property, it should be a reference not a string
        if (content.includes('model:')) {
          test(`${subdir}/${file}: model property is a reference (not a string literal)`, () => {
            // model: Post (not model: 'Post')
            const modelMatch = content.match(/model:\s*(\S+)/)
            if (modelMatch) {
              const value = modelMatch[1].replace(/,?\s*$/, '')
              // Should not be a quoted string
              expect(value).not.toMatch(/^'/)
              expect(value).not.toMatch(/^"/)
            }
          })
        }
      }
    }
  }
})

// ─── 8. No generated ORM imports in consumer files ────────────────────

describe('consumer files do not import from deleted generated directories', () => {
  function checkDirectory(dir: string, label: string): void {
    if (!existsSync(dir)) return
    const files: string[] = []
    const scanDir = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        if (entry.isDirectory()) scanDir(join(d, entry.name))
        else if (entry.name.endsWith('.ts')) files.push(join(d, entry.name))
      }
    }
    scanDir(dir)

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const relativePath = file.replace(rootDir + '/', '')

      if (content.includes('orm/src/types/')) {
        test(`${label} ${relativePath}: does NOT import from orm/src/types/`, () => {
          expect(content).not.toContain("from '")
          // This test body intentionally always passes if we reach this point,
          // the actual check is the if condition above generating the test
        })
      }

      if (content.includes('orm/src/models/')) {
        test(`${label} ${relativePath}: does NOT import from orm/src/models/`, () => {
          expect(content).not.toContain("from '")
        })
      }
    }
  }

  // Verify key consumer directories
  test('CMS files do not import from deleted orm/src/types', () => {
    const scanForBadImports = (dir: string): string[] => {
      const violations: string[] = []
      if (!existsSync(dir)) return violations
      const files: string[] = []
      const scanDir = (d: string) => {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
          if (entry.isDirectory()) scanDir(join(d, entry.name))
          else if (entry.name.endsWith('.ts')) files.push(join(d, entry.name))
        }
      }
      scanDir(dir)
      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        if (content.includes("from '") && content.includes('orm/src/types/')) {
          violations.push(file.replace(rootDir + '/', ''))
        }
      }
      return violations
    }

    expect(scanForBadImports(cmsDir)).toEqual([])
    expect(scanForBadImports(commerceDir)).toEqual([])
  })
})

// ─── 9. server-auto-imports.d.ts covers all models ────────────────────

describe('server-auto-imports.d.ts covers all model definitions', () => {
  const autoImportsFile = join(typesDir, 'server-auto-imports.d.ts')
  const autoImportsContent = readFileSync(autoImportsFile, 'utf-8')

  test('every framework model is declared as a global', () => {
    const models = getModelFiles(frameworkModelsDir)
    for (const file of models) {
      const modelName = file.replace('.ts', '')
      expect(autoImportsContent).toContain(`const ${modelName}:`)
    }
  })

  test('every default model is declared as a global (if not overridden)', () => {
    const frameworkModelNames = new Set(getModelFiles(frameworkModelsDir).map(f => f.replace('.ts', '')))
    const defaultModels = getModelFiles(defaultModelsDir)
    for (const file of defaultModels) {
      const modelName = file.replace('.ts', '')
      // Default models should appear unless overridden by framework model
      expect(autoImportsContent).toContain(`const ${modelName}:`)
    }
  })

  test('no model is declared more than once', () => {
    const declarations = autoImportsContent.match(/const \w+:/g) || []
    const names = declarations.map(d => d.replace('const ', '').replace(':', ''))
    const uniqueNames = [...new Set(names)]
    expect(names.length).toBe(uniqueNames.length)
  })
})

// ─── 10. Commerce categories/update.ts uses proper return types ───────

describe('commerce update functions use ModelRow return types', () => {
  const updateFile = join(commerceDir, 'products/categories/update.ts')

  if (existsSync(updateFile)) {
    test('update() does NOT return Promise<Record<string, any>>', () => {
      const content = readFileSync(updateFile, 'utf-8')
      expect(content).not.toContain('Promise<Record<string, any>>')
    })

    test('updateDisplayOrder() does NOT return Promise<Record<string, any>>', () => {
      const content = readFileSync(updateFile, 'utf-8')
      // Count occurrences — should be zero
      const matches = content.match(/Promise<Record<string, any>/g)
      expect(matches).toBeNull()
    })
  }
})

// ─── 11. Global type chain verification ───────────────────────────────

describe('full type inference chain is structurally correct', () => {
  test('defineModel returns object with _isStacksModel + getDefinition', () => {
    const content = readFileSync(join(coreOrmDir, 'define-model.ts'), 'utf-8')
    expect(content).toContain('_isStacksModel: true as const')
    expect(content).toContain('getDefinition: () => definition')
  })

  test('model-types.ts Def type extracts definition via getDefinition', () => {
    const content = readFileSync(join(coreOrmDir, 'model-types.ts'), 'utf-8')
    expect(content).toContain('T extends { getDefinition: () => infer D')
  })

  test('ModelRow composes ModelAttributes with BelongsToForeignKeys', () => {
    const content = readFileSync(join(coreOrmDir, 'model-types.ts'), 'utf-8')
    expect(content).toContain('ModelAttributes<Def<T>> & BelongsToForeignKeys<Def<T>>')
  })

  test('orm-globals.d.ts maps RequestInstance<TModel> to _RequestInstance<_ModelRow<TModel>>', () => {
    const content = readFileSync(join(typesDir, 'orm-globals.d.ts'), 'utf-8')
    expect(content).toContain('_RequestInstance<_ModelRow<TModel>>')
  })

  test('Action InferRequest uses _isStacksModel to resolve RequestInstance', () => {
    const content = readFileSync(join(rootDir, 'storage/framework/core/actions/src/action.ts'), 'utf-8')
    expect(content).toContain("TModel extends { _isStacksModel: true }")
  })
})

// ─── 12. model-types.ts no leaky abstractions ─────────────────────────

describe('model-types.ts has no leaky abstractions', () => {
  const content = readFileSync(join(coreOrmDir, 'model-types.ts'), 'utf-8')

  test('does NOT reference Kysely types', () => {
    expect(content).not.toContain('Kysely')
    expect(content).not.toContain('Generated<')
    expect(content).not.toContain('Selectable<')
    expect(content).not.toContain('Insertable<')
  })

  test('does NOT reference generated type file names', () => {
    expect(content).not.toContain('PostType')
    expect(content).not.toContain('UserType')
    expect(content).not.toContain('PostsTable')
    expect(content).not.toContain('UsersTable')
  })

  test('uses only bun-query-builder type utilities', () => {
    expect(content).toContain("from 'bun-query-builder'")
    expect(content).toContain('ModelAttributes')
    expect(content).toContain('InferModelAttributes')
    expect(content).toContain('ModelDefinition')
  })
})
