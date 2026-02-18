import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const rootDir = resolve(import.meta.dir, '../..')
const typesDir = join(rootDir, 'storage/framework/orm/src/types')
const modelsDir = join(rootDir, 'storage/framework/orm/src/models')
const actionPathsFile = join(rootDir, 'storage/framework/core/router/src/action-paths.ts')
const stacksRouterFile = join(rootDir, 'storage/framework/core/router/src/stacks-router.ts')
const baseOrmFile = join(rootDir, 'storage/framework/orm/src/utils/base.ts')
const generateFile = join(rootDir, 'storage/framework/core/orm/src/generate.ts')
const barrelFile = join(rootDir, 'storage/framework/orm/src/index.ts')
const modelTypesFile = join(rootDir, 'storage/framework/core/orm/src/model-types.ts')

// ─── Helpers ──────────────────────────────────────────────────────────

function getTypeFiles(): string[] {
  return readdirSync(typesDir).filter(f => {
    if (!f.endsWith('Type.ts')) return false
    // Skip empty stub files (0 bytes) leftover from old models
    const content = readFileSync(join(typesDir, f), 'utf-8').trim()
    return content.length > 0
  })
}

function readTypeFile(name: string): string {
  return readFileSync(join(typesDir, name), 'utf-8')
}

function extractModelName(filename: string): string {
  return filename.replace('Type.ts', '')
}

function getModelFiles(): string[] {
  return readdirSync(modelsDir).filter(f => {
    if (!f.endsWith('.ts') || f === 'index.ts') return false
    const content = readFileSync(join(modelsDir, f), 'utf-8').trim()
    return content.length > 0
  })
}

// ─── 1. No [key: string]: any in generated types ─────────────────────

describe('JsonResponse types: no index signatures', () => {
  const typeFiles = getTypeFiles()

  test('should have type files to test', () => {
    expect(typeFiles.length).toBeGreaterThan(0)
  })

  for (const file of typeFiles) {
    const modelName = extractModelName(file)
    test(`${modelName}JsonResponse must NOT contain [key: string]: any`, () => {
      const content = readTypeFile(file)
      expect(content).not.toContain('[key: string]: any')
    })
  }

  test('no type file anywhere contains [key: string]: any', () => {
    let totalViolations = 0
    for (const file of typeFiles) {
      const content = readTypeFile(file)
      if (content.includes('[key: string]: any')) {
        totalViolations++
      }
    }
    expect(totalViolations).toBe(0)
  })
})

// ─── 2. RelationName types exist for every model ─────────────────────

describe('RelationName types: existence and correctness', () => {
  const typeFiles = getTypeFiles()

  for (const file of typeFiles) {
    const modelName = extractModelName(file)
    test(`${modelName}RelationName type must be defined`, () => {
      const content = readTypeFile(file)
      const hasRelationName = content.includes(`export type ${modelName}RelationName =`)
      expect(hasRelationName).toBe(true)
    })
  }

  test('PostRelationName must include author, tags, categories, comments', () => {
    const content = readTypeFile('PostType.ts')
    const match = content.match(/export type PostRelationName = (.+)/)
    expect(match).not.toBeNull()
    const typeValue = match![1]
    expect(typeValue).toContain("'author'")
    expect(typeValue).toContain("'tags'")
    expect(typeValue).toContain("'categories'")
    expect(typeValue).toContain("'comments'")
  })

  test('UserRelationName must include personal_access_token and customer', () => {
    const content = readTypeFile('UserType.ts')
    const match = content.match(/export type UserRelationName = (.+)/)
    expect(match).not.toBeNull()
    const typeValue = match![1]
    expect(typeValue).toContain("'personal_access_token'")
    expect(typeValue).toContain("'customer'")
  })

  test('PaymentRelationName must include order and customer', () => {
    const content = readTypeFile('PaymentType.ts')
    const match = content.match(/export type PaymentRelationName = (.+)/)
    expect(match).not.toBeNull()
    const typeValue = match![1]
    expect(typeValue).toContain("'order'")
    expect(typeValue).toContain("'customer'")
  })

  test('ShippingRateRelationName must include shipping_method and shipping_zone', () => {
    const content = readTypeFile('ShippingRateType.ts')
    const match = content.match(/export type ShippingRateRelationName = (.+)/)
    expect(match).not.toBeNull()
    const typeValue = match![1]
    expect(typeValue).toContain("'shipping_method'")
    expect(typeValue).toContain("'shipping_zone'")
  })

  test('models without relations must have RelationName = never', () => {
    // Models like EmailList, Websocket, FailedJob should have never
    const modelsWithNoRelations = ['EmailListType.ts', 'WebsocketType.ts', 'FailedJobType.ts']
    for (const file of modelsWithNoRelations) {
      if (!existsSync(join(typesDir, file))) continue
      const content = readTypeFile(file)
      const modelName = extractModelName(file)
      expect(content).toContain(`export type ${modelName}RelationName = never`)
    }
  })

  test('RelationName types must only contain string literal members', () => {
    for (const file of typeFiles) {
      const content = readTypeFile(file)
      const modelName = extractModelName(file)
      const match = content.match(new RegExp(`export type ${modelName}RelationName = (.+)`))
      if (!match) continue
      const typeValue = match[1].trim()
      // Must be either 'never' or a union of string literals
      if (typeValue === 'never') continue
      // Each member must be a quoted string: 'something'
      const members = typeValue.split('|').map(m => m.trim())
      for (const member of members) {
        expect(member).toMatch(/^'[a-z_]+'$/)
      }
    }
  })
})

// ─── 3. with() uses RelationName, not string[] ──────────────────────

describe('with() type narrowing', () => {
  const typeFiles = getTypeFiles()

  for (const file of typeFiles) {
    const modelName = extractModelName(file)
    test(`${modelName}ModelType uses BaseModelType with ${modelName}RelationName (narrowing with())`, () => {
      const content = readTypeFile(file)
      // ModelType uses BaseModelType<..., RelationName, ModelType> which provides
      // with: (relations: TRelation[]) => TSelf — narrowed to correct types through generics
      expect(content).toContain(`${modelName}RelationName, ${modelName}ModelType> & {`)
      // Must NOT have old-style inline with: (relations: string[])
      expect(content).not.toContain(`with: (relations: string[])`)
    })
  }

  test('BaseModelType (in model-types.ts) with() uses TRelation[], not string[]', () => {
    const modelTypesContent = readFileSync(modelTypesFile, 'utf-8')
    expect(modelTypesContent).toContain('with: (relations: TRelation[]) => TSelf')
    expect(modelTypesContent).not.toContain('with: (relations: string[])')
  })

  test('generated model classes import RelationName type', () => {
    const generateContent = readFileSync(generateFile, 'utf-8')
    expect(generateContent).toContain('RelationName')
    // The template string should include ModelNameRelationName in imports
    expect(generateContent).toMatch(/\$\{modelName\}RelationName/)
  })
})

// ─── 4. orWhere() uses keyof Table, not [string, any][] ─────────────

describe('orWhere() type narrowing', () => {
  test('BaseModelType (in model-types.ts) orWhere uses keyof TTable, not string', () => {
    const modelTypesContent = readFileSync(modelTypesFile, 'utf-8')
    expect(modelTypesContent).toContain('orWhere: (...conditions: [keyof TTable, any][]) => TSelf')
    expect(modelTypesContent).not.toContain('orWhere: (...conditions: [string, any][])')
  })

  test('BaseOrm applyOrWhere uses keyof C', () => {
    const baseContent = readFileSync(baseOrmFile, 'utf-8')
    expect(baseContent).toContain('applyOrWhere(...conditions: [keyof C, any][])')
  })

  test('BaseOrm orWhere uses keyof C', () => {
    const baseContent = readFileSync(baseOrmFile, 'utf-8')
    expect(baseContent).toContain('orWhere(...conditions: [keyof C, any][])')
  })
})

// ─── 5. where(), orderBy(), etc. still use keyof Table ──────────────

describe('other query methods use keyof Table (not string)', () => {
  test('BaseModelType where() uses keyof TTable (narrowed per model through generics)', () => {
    const modelTypesContent = readFileSync(modelTypesFile, 'utf-8')
    expect(modelTypesContent).toContain('where: <V = string>(column: keyof TTable, ...args: [V] | [Operator, V]) => TSelf')
  })

  test('BaseModelType orderBy() uses keyof TTable', () => {
    const modelTypesContent = readFileSync(modelTypesFile, 'utf-8')
    expect(modelTypesContent).toContain('orderBy: (column: keyof TTable')
  })

  test('BaseModelType whereNull() uses keyof TTable', () => {
    const modelTypesContent = readFileSync(modelTypesFile, 'utf-8')
    expect(modelTypesContent).toContain('whereNull: (column: keyof TTable)')
  })

  test('BaseModelType groupBy() uses keyof TTable', () => {
    const modelTypesContent = readFileSync(modelTypesFile, 'utf-8')
    expect(modelTypesContent).toContain('groupBy: (column: keyof TTable)')
  })

  test('type files use BaseModelType with their specific Table type (narrowing all methods)', () => {
    const typeFiles = getTypeFiles()
    for (const file of typeFiles) {
      const modelName = extractModelName(file)
      const content = readTypeFile(file)
      // Each type file passes its Table type to BaseModelType, which narrows keyof TTable
      const pattern = new RegExp(`BaseModelType<\\w+Table, ${modelName}JsonResponse`)
      expect(content).toMatch(pattern)
    }
  })
})

// ─── 6. JsonResponse has explicit relation properties ────────────────

describe('JsonResponse has explicit typed relation properties', () => {
  test('PostJsonResponse has author?: AuthorJsonResponse', () => {
    const content = readTypeFile('PostType.ts')
    expect(content).toContain('author?: AuthorJsonResponse')
  })

  test('PostJsonResponse has optional tags, categories, comments arrays', () => {
    const content = readTypeFile('PostType.ts')
    expect(content).toContain('tags?: any[]')
    expect(content).toContain('categories?: any[]')
    expect(content).toContain('comments?: any[]')
  })

  test('UserJsonResponse has personal_access_token and customer relations', () => {
    const content = readTypeFile('UserType.ts')
    expect(content).toContain('personal_access_token?: PersonalAccessTokenJsonResponse[]')
    expect(content).toContain('customer?: CustomerJsonResponse[]')
  })

  test('PostJsonResponse imports AuthorJsonResponse type', () => {
    const content = readTypeFile('PostType.ts')
    expect(content).toContain("import type { AuthorJsonResponse } from './AuthorType'")
  })

  test('UserJsonResponse imports PersonalAccessTokenJsonResponse', () => {
    const content = readTypeFile('UserType.ts')
    expect(content).toContain("import type { PersonalAccessTokenJsonResponse } from './PersonalAccessTokenType'")
  })

  test('UserJsonResponse imports CustomerJsonResponse', () => {
    const content = readTypeFile('UserType.ts')
    expect(content).toContain("import type { CustomerJsonResponse } from './CustomerType'")
  })
})

// ─── 7. StacksActionPath is a narrow union type ─────────────────────

describe('StacksActionPath union type', () => {
  let actionPathsContent: string

  test('action-paths.ts file exists', () => {
    expect(existsSync(actionPathsFile)).toBe(true)
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
  })

  test('exports StacksActionPath type', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain('export type StacksActionPath =')
  })

  test('is not a plain string type', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    // Ensure it's NOT `export type StacksActionPath = string`
    expect(actionPathsContent).not.toMatch(/export type StacksActionPath = string\s*$/)
  })

  test('contains core auth actions', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Auth/LoginAction'")
    expect(actionPathsContent).toContain("'Actions/Auth/RegisterAction'")
    expect(actionPathsContent).toContain("'Actions/Auth/LogoutAction'")
    expect(actionPathsContent).toContain("'Actions/Auth/RefreshTokenAction'")
    expect(actionPathsContent).toContain("'Actions/Auth/CreateTokenAction'")
    expect(actionPathsContent).toContain("'Actions/Auth/ListTokensAction'")
    expect(actionPathsContent).toContain("'Actions/Auth/RevokeTokenAction'")
  })

  test('contains passkey auth actions (previously missing)', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Auth/GenerateRegistrationAction'")
    expect(actionPathsContent).toContain("'Actions/Auth/VerifyRegistrationAction'")
    expect(actionPathsContent).toContain("'Actions/Auth/GenerateAuthenticationAction'")
    expect(actionPathsContent).toContain("'Actions/Auth/VerifyAuthenticationAction'")
  })

  test('contains payment actions (previously missing)', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Payment/FetchPaymentCustomerAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/CreateSubscriptionAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/CancelSubscriptionAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/CreateCheckoutAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/FetchProductAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/StoreTransactionAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/FetchTransactionHistoryAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/FetchUserSubscriptionsAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/FetchActiveSubscriptionAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/FetchDefaultPaymentMethodAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/FetchPaymentMethodsAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/CreateSetupIntentAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/DeleteDefaultPaymentAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/UpdateDefaultPaymentMethodAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/SetDefaultPaymentAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/SetUserDefaultPaymentAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/StorePaymentMethodAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/CreatePaymentIntentAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/UpdateSubscriptionAction'")
    expect(actionPathsContent).toContain("'Actions/Payment/CreateInvoiceSubscription'")
    expect(actionPathsContent).toContain("'Actions/Payment/UpdateCustomerAction'")
  })

  test('contains queue actions (previously missing)', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Queue/FetchQueuesAction'")
  })

  test('contains install action (previously missing)', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/InstallAction'")
  })

  test('contains buddy actions including Versions and Commands', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Buddy/VersionsAction'")
    expect(actionPathsContent).toContain("'Actions/Buddy/CommandsAction'")
    expect(actionPathsContent).toContain("'Actions/Buddy/BuddyStateAction'")
    expect(actionPathsContent).toContain("'Actions/Buddy/BuddyProcessAction'")
  })

  test('contains CMS actions', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Cms/PostIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Cms/PostShowAction'")
    expect(actionPathsContent).toContain("'Actions/Cms/PostStoreAction'")
    expect(actionPathsContent).toContain("'Actions/Cms/PostUpdateAction'")
    expect(actionPathsContent).toContain("'Actions/Cms/PostDestroyAction'")
    expect(actionPathsContent).toContain("'Actions/Cms/AuthorIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Cms/TaggableIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Cms/CategorizableIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Cms/CommentIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Cms/RssFeedAction'")
    expect(actionPathsContent).toContain("'Actions/Cms/SitemapAction'")
  })

  test('contains commerce actions', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Commerce/OrderIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/CustomerIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/CouponIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/GiftCardIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/TaxRateIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/PaymentIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/ReceiptIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/PrintDeviceIndexAction'")
  })

  test('contains shipping actions', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Commerce/Shipping/ShippingMethodIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/Shipping/ShippingRateIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/Shipping/ShippingZoneIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/Shipping/DeliveryRouteIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/Shipping/DriverIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/Shipping/DigitalDeliveryIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/Shipping/LicenseKeyIndexAction'")
  })

  test('contains product actions', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Commerce/Product/ProductIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/Product/ProductShowAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/Product/ProductStoreAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/Product/ProductVariantIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Commerce/Product/ManufacturerIndexAction'")
  })

  test('contains controller paths', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Controllers/ComingSoonController@index'")
    expect(actionPathsContent).toContain("'Controllers/QueryController@getStats'")
    expect(actionPathsContent).toContain("'Controllers/QueryController@getRecentQueries'")
    expect(actionPathsContent).toContain("'Controllers/QueryController@getSlowQueries'")
    expect(actionPathsContent).toContain("'Controllers/QueryController@getQuery'")
    expect(actionPathsContent).toContain("'Controllers/QueryController@getQueryTimeline'")
    expect(actionPathsContent).toContain("'Controllers/QueryController@getFrequentQueries'")
    expect(actionPathsContent).toContain("'Controllers/QueryController@pruneQueryLogs'")
  })

  test('contains monitoring actions', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Monitoring/ErrorIndexAction'")
    expect(actionPathsContent).toContain("'Actions/Monitoring/ErrorShowAction'")
    expect(actionPathsContent).toContain("'Actions/Monitoring/ErrorStatsAction'")
    expect(actionPathsContent).toContain("'Actions/Monitoring/ErrorResolveAction'")
    expect(actionPathsContent).toContain("'Actions/Monitoring/ErrorDestroyAction'")
  })

  test('contains dashboard actions from framework defaults', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Dashboard/DashboardStatsAction'")
    expect(actionPathsContent).toContain("'Actions/Dashboard/DashboardActivityAction'")
    expect(actionPathsContent).toContain("'Actions/Dashboard/DashboardHealthAction'")
  })

  test('contains misc actions', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/HealthAction'")
    expect(actionPathsContent).toContain("'Actions/TestErrorAction'")
    expect(actionPathsContent).toContain("'Actions/SubscriberEmailAction'")
    expect(actionPathsContent).toContain("'Actions/AI/AskAction'")
    expect(actionPathsContent).toContain("'Actions/AI/SummaryAction'")
    expect(actionPathsContent).toContain("'Actions/UploadTestAction'")
    expect(actionPathsContent).toContain("'Actions/Realtime/FetchWebsocketsAction'")
  })

  test('contains password actions', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    expect(actionPathsContent).toContain("'Actions/Password/PasswordResetAction'")
    expect(actionPathsContent).toContain("'Actions/Password/SendPasswordResetEmailAction'")
    expect(actionPathsContent).toContain("'Actions/Password/VerifyResetTokenAction'")
  })

  test('all action paths follow the Actions/ or Controllers/ prefix pattern', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    const pathMatches = actionPathsContent.match(/\| '([^']+)'/g)
    expect(pathMatches).not.toBeNull()
    for (const match of pathMatches!) {
      const path = match.replace("| '", '').replace("'", '')
      expect(path.startsWith('Actions/') || path.startsWith('Controllers/')).toBe(true)
    }
  })

  test('no duplicate action paths', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    const pathMatches = actionPathsContent.match(/\| '([^']+)'/g)
    expect(pathMatches).not.toBeNull()
    const paths = pathMatches!.map(m => m.replace("| '", '').replace("'", ''))
    const uniquePaths = [...new Set(paths)]
    expect(paths.length).toBe(uniquePaths.length)
  })

  test('action paths are sorted alphabetically', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    const pathMatches = actionPathsContent.match(/\| '([^']+)'/g)
    expect(pathMatches).not.toBeNull()
    const paths = pathMatches!.map(m => m.replace("| '", '').replace("'", ''))
    const sorted = [...paths].sort()
    expect(paths).toEqual(sorted)
  })

  test('has at least 250 action paths (comprehensive coverage)', () => {
    actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
    const pathMatches = actionPathsContent.match(/\| '([^']+)'/g)
    expect(pathMatches).not.toBeNull()
    expect(pathMatches!.length).toBeGreaterThanOrEqual(250)
  })
})

// ─── 8. Route action strings match StacksActionPath union ────────────

describe('route files: all action strings exist in StacksActionPath', () => {
  const actionPathsContent = readFileSync(actionPathsFile, 'utf-8')
  const routeApiFile = join(rootDir, 'routes/api.ts')
  const routeBuddyFile = join(rootDir, 'routes/buddy.ts')

  function extractActionStringsFromRouteFile(filePath: string): string[] {
    if (!existsSync(filePath)) return []
    const content = readFileSync(filePath, 'utf-8')
    const matches = content.match(/'(Actions\/[^']+|Controllers\/[^']+)'/g)
    if (!matches) return []
    return [...new Set(matches.map(m => m.slice(1, -1)))]
  }

  const apiActions = extractActionStringsFromRouteFile(routeApiFile)
  const buddyActions = extractActionStringsFromRouteFile(routeBuddyFile)

  test('routes/api.ts has action strings to verify', () => {
    expect(apiActions.length).toBeGreaterThan(50)
  })

  // Test each action string from routes/api.ts
  for (const action of apiActions) {
    // Skip actions we know don't have files yet (ProductUpdateAction, ProductDestroyAction)
    if (action === 'Actions/Commerce/Product/ProductUpdateAction' || action === 'Actions/Commerce/Product/ProductDestroyAction') {
      test.skip(`${action} (file does not exist yet)`, () => {})
      continue
    }
    test(`routes/api.ts: '${action}' exists in StacksActionPath`, () => {
      expect(actionPathsContent).toContain(`'${action}'`)
    })
  }

  // Test each action string from routes/buddy.ts
  for (const action of buddyActions) {
    test(`routes/buddy.ts: '${action}' exists in StacksActionPath`, () => {
      expect(actionPathsContent).toContain(`'${action}'`)
    })
  }
})

// ─── 9. Stacks router uses StacksActionPath, not plain string ────────

describe('stacks-router uses StacksActionPath (not string)', () => {
  const routerContent = readFileSync(stacksRouterFile, 'utf-8')

  test('imports StacksActionPath from action-paths', () => {
    expect(routerContent).toContain("import type { StacksActionPath } from './action-paths'")
  })

  test('StacksHandler uses StacksActionPath (not string)', () => {
    expect(routerContent).toContain('type StacksHandler = ActionHandler | StacksActionPath')
  })

  test('does NOT use StringHandler = string', () => {
    expect(routerContent).not.toContain('type StringHandler = string')
  })
})

// ─── 10. Barrel file exports RelationName for all models ─────────────

describe('barrel file exports RelationName for all models', () => {
  const barrelContent = readFileSync(barrelFile, 'utf-8')
  const typeFiles = getTypeFiles()

  for (const file of typeFiles) {
    const modelName = extractModelName(file)
    test(`barrel exports ${modelName}RelationName`, () => {
      expect(barrelContent).toContain(`${modelName}RelationName`)
    })
  }
})

// ─── 11. Generated model classes use narrow types ────────────────────

describe('generated model classes use narrow types', () => {
  const modelFiles = getModelFiles()

  test('should have model files to test', () => {
    expect(modelFiles.length).toBeGreaterThan(0)
  })

  for (const file of modelFiles) {
    const modelName = file.replace('.ts', '')

    test(`${modelName} model imports RelationName type`, () => {
      const content = readFileSync(join(modelsDir, file), 'utf-8')
      expect(content).toContain(`${modelName}RelationName`)
    })

    test(`${modelName} model with() uses RelationName (inherited from BaseOrm, typed in import)`, () => {
      const content = readFileSync(join(modelsDir, file), 'utf-8')
      // Model imports its RelationName type (used in the type file's BaseModelType<...>)
      expect(content).toContain(`${modelName}RelationName`)
      // Must NOT have old-style with(relations: string[])
      expect(content).not.toMatch(new RegExp(`with\\(relations:\\s*string\\[\\]\\)`))
    })
  }
})

// ─── 12. Table interfaces have proper column definitions ─────────────

describe('table interfaces are well-typed', () => {
  test('PostsTable has expected columns', () => {
    const content = readTypeFile('PostType.ts')
    expect(content).toContain('id: Generated<number>')
    expect(content).toContain('title?: string')
    expect(content).toContain('content?: string')
    expect(content).toContain('excerpt?: string')
    expect(content).toContain('views?: number')
    expect(content).toContain('status?: string | string[]')
    expect(content).toContain('created_at?: string')
    expect(content).toContain('updated_at?: string')
  })

  test('UsersTable has expected columns', () => {
    const content = readTypeFile('UserType.ts')
    expect(content).toContain('id: Generated<number>')
    expect(content).toContain('name: string')
    expect(content).toContain('email: string')
    expect(content).toContain('password: string')
  })

  test('PostsTable does NOT have [key: string] index', () => {
    const content = readTypeFile('PostType.ts')
    // Check the table interface specifically
    const tableSection = content.split('export interface PostsTable')[1]?.split('}')[0]
    expect(tableSection).not.toContain('[key: string]')
  })
})

// ─── 13. Consistency: ModelType interface matches Table columns ───────

describe('ModelType interface consistency', () => {
  test('PostModelType has getters/setters matching PostsTable columns', () => {
    const content = readTypeFile('PostType.ts')
    // Every column in PostsTable should have a getter in PostModelType
    // (camelCase for multi-word columns)
    expect(content).toContain('get title():')
    expect(content).toContain('get content():')
    expect(content).toContain('get excerpt():')
    expect(content).toContain('get views():')
    expect(content).toContain('get status():')
  })

  test('PostModelType methods return PostModelType (not any)', () => {
    const content = readTypeFile('PostType.ts')
    expect(content).not.toMatch(/:\s*any\s*$/) // should not end with `: any`
    // PostModelType uses BaseModelType<PostsTable, ..., PostModelType> which gives
    // where: <V = string>(column: keyof PostsTable, ...) => PostModelType through generics
    expect(content).toContain('BaseModelType<PostsTable, PostJsonResponse, NewPost, PostUpdate, PostRelationName, PostModelType>')
  })
})

// ─── 14. Generator template correctness ──────────────────────────────

describe('generator templates produce correct code', () => {
  const generateContent = readFileSync(generateFile, 'utf-8')

  test('generate.ts imports RelationName from type file', () => {
    expect(generateContent).toContain('${modelName}RelationName')
  })

  test('generate.ts model extends BaseOrm', () => {
    expect(generateContent).toContain('extends BaseOrm<')
  })

  test('generate.ts does NOT generate static select/where/find/first/last/orderBy in model', () => {
    // These generic static methods are now inherited from BaseOrm
    // The generate template should NOT contain standalone static where/find/first/last/select/orderBy
    // (though it may contain model-specific static whereXxx convenience methods)
    expect(generateContent).not.toContain('static select<K extends keyof')
    expect(generateContent).not.toContain('static select(params: RawBuilder')
    // Generic static where/find/first/last/orderBy should not be in the template
    expect(generateContent).not.toMatch(/static where\(column:/)
    expect(generateContent).not.toMatch(/static find\(id: number\)/)
    expect(generateContent).not.toMatch(/static first\(\)/)
    expect(generateContent).not.toMatch(/static last\(\)/)
    expect(generateContent).not.toMatch(/static orderBy\(column:/)
  })
})

// ─── 15. Type files use BaseModelType (not inline SelectedQuery imports) ─

describe('type files use BaseModelType from @stacksjs/orm', () => {
  const typeFiles = getTypeFiles()

  for (const file of typeFiles) {
    const modelName = extractModelName(file)

    test(`${modelName} type file imports BaseModelType from @stacksjs/orm`, () => {
      const content = readTypeFile(file)
      expect(content).toContain("import type { BaseModelType } from '@stacksjs/orm'")
    })

    test(`${modelName} type file does NOT directly import Operator or SelectedQuery`, () => {
      const content = readTypeFile(file)
      // Type files should no longer import these directly — they come through BaseModelType
      expect(content).not.toContain("import type { Operator, SelectedQuery } from '@stacksjs/orm'")
      expect(content).not.toContain("import type { Operator } from '@stacksjs/orm'")
      expect(content).not.toContain("import type { SelectedQuery } from '@stacksjs/orm'")
    })

    test(`${modelName}ModelType is defined as BaseModelType<...> intersection`, () => {
      const content = readTypeFile(file)
      // The model type should be a type alias using BaseModelType, not a plain interface
      const pattern = new RegExp(
        `export type ${modelName}ModelType = BaseModelType<\\w+Table, ${modelName}JsonResponse, New${modelName}, ${modelName}Update, ${modelName}RelationName, ${modelName}ModelType> & \\{`
      )
      expect(content).toMatch(pattern)
    })

    test(`${modelName}ModelType is NOT defined as a plain interface`, () => {
      const content = readTypeFile(file)
      // Should NOT have the old-style interface with 55+ inline methods
      expect(content).not.toContain(`export interface ${modelName}ModelType {`)
    })
  }

  test('BaseModelType select overload provides SelectedQuery through the type hierarchy', () => {
    // Verify that the shared model-types.ts contains select with SelectedQuery
    const modelTypesContent = readFileSync(modelTypesFile, 'utf-8')
    expect(modelTypesContent).toContain('<K extends keyof TTable & string>(fields: K[]): SelectedQuery<TTable, TJson, K>')
    expect(modelTypesContent).toContain('(params: RawBuilder<string> | string): TSelf')
  })

  test('BaseOrm select() has overloads returning SelectedQuery', () => {
    const baseContent = readFileSync(baseOrmFile, 'utf-8')
    expect(baseContent).toContain('select<K extends keyof C & string>(fields: K[]): SelectedQuery<C, J, K>')
    expect(baseContent).toContain('select(params: RawBuilder<string> | string): this')
  })

  test('BaseOrm imports SelectedQuery', () => {
    const baseContent = readFileSync(baseOrmFile, 'utf-8')
    expect(baseContent).toContain("import type { Operator, SelectedQuery } from '@stacksjs/orm'")
  })
})

// ─── 16. BaseModelType and QueryMethods in model-types.ts ────────────

describe('BaseModelType and QueryMethods are defined in model-types.ts', () => {
  const modelTypesContent = readFileSync(modelTypesFile, 'utf-8')

  test('model-types.ts exists', () => {
    expect(existsSync(modelTypesFile)).toBe(true)
  })

  test('exports QueryMethods interface', () => {
    expect(modelTypesContent).toContain('export interface QueryMethods<')
  })

  test('exports BaseModelType type alias', () => {
    expect(modelTypesContent).toContain('export type BaseModelType<')
  })

  test('BaseModelType extends QueryMethods with readonly id', () => {
    expect(modelTypesContent).toContain('QueryMethods<TTable, TJson, TNew, TUpdate, TRelation, TSelf>')
    expect(modelTypesContent).toContain('readonly id: number')
  })

  test('QueryMethods has all shared query method signatures', () => {
    // Relation loading
    expect(modelTypesContent).toContain('with: (relations: TRelation[]) => TSelf')

    // Select overloads
    expect(modelTypesContent).toContain('select: {')
    expect(modelTypesContent).toContain('<K extends keyof TTable & string>(fields: K[]): SelectedQuery<TTable, TJson, K>')

    // Finders
    expect(modelTypesContent).toContain('find: (id: number) => Promise<TSelf | undefined>')
    expect(modelTypesContent).toContain('first: () => Promise<TSelf | undefined>')
    expect(modelTypesContent).toContain('last: () => Promise<TSelf | undefined>')
    expect(modelTypesContent).toContain('all: () => Promise<TSelf[]>')
    expect(modelTypesContent).toContain('findOrFail: (id: number) => Promise<TSelf | undefined>')
    expect(modelTypesContent).toContain('findMany: (ids: number[]) => Promise<TSelf[]>')

    // Where clauses
    expect(modelTypesContent).toContain('where: <V = string>(column: keyof TTable, ...args: [V] | [Operator, V]) => TSelf')
    expect(modelTypesContent).toContain('orWhere: (...conditions: [keyof TTable, any][]) => TSelf')
    expect(modelTypesContent).toContain('whereNull: (column: keyof TTable) => TSelf')
    expect(modelTypesContent).toContain('whereNotNull: (column: keyof TTable) => TSelf')
    expect(modelTypesContent).toContain('whereIn: <V = number>(column: keyof TTable, values: V[]) => TSelf')
    expect(modelTypesContent).toContain('whereNotIn: <V = number>(column: keyof TTable, values: V[]) => TSelf')
    expect(modelTypesContent).toContain('whereBetween: <V = number>(column: keyof TTable, range: [V, V]) => TSelf')
    expect(modelTypesContent).toContain('whereLike: (column: keyof TTable, value: string) => TSelf')

    // Ordering
    expect(modelTypesContent).toContain('orderBy: (column: keyof TTable, order: \'asc\' | \'desc\') => TSelf')
    expect(modelTypesContent).toContain('orderByAsc: (column: keyof TTable) => TSelf')
    expect(modelTypesContent).toContain('orderByDesc: (column: keyof TTable) => TSelf')

    // Grouping
    expect(modelTypesContent).toContain('groupBy: (column: keyof TTable) => TSelf')

    // Aggregates
    expect(modelTypesContent).toContain('max: (field: keyof TTable) => Promise<number>')
    expect(modelTypesContent).toContain('min: (field: keyof TTable) => Promise<number>')
    expect(modelTypesContent).toContain('avg: (field: keyof TTable) => Promise<number>')
    expect(modelTypesContent).toContain('sum: (field: keyof TTable) => Promise<number>')
    expect(modelTypesContent).toContain('count: () => Promise<number>')

    // Terminal collection methods
    expect(modelTypesContent).toContain('get: () => Promise<TSelf[]>')
    expect(modelTypesContent).toContain('paginate: (options?:')
    expect(modelTypesContent).toContain('chunk: (size: number, callback: (models: TSelf[]) => Promise<void>) => Promise<void>')

    // Mutation methods
    expect(modelTypesContent).toContain('create: (newRecord: TNew) => Promise<TSelf>')
    expect(modelTypesContent).toContain('save: () => Promise<TSelf>')
    expect(modelTypesContent).toContain('delete: () => Promise<number>')
    expect(modelTypesContent).toContain('toJSON: () => TJson')
  })

  test('QueryMethods imports Operator and SelectedQuery', () => {
    expect(modelTypesContent).toContain("import type { Operator } from './subquery'")
    expect(modelTypesContent).toContain("import type { SelectedQuery } from './types'")
  })

  test('model-types.ts is re-exported from @stacksjs/orm barrel', () => {
    const ormIndexFile = join(rootDir, 'storage/framework/core/orm/src/index.ts')
    const ormIndex = readFileSync(ormIndexFile, 'utf-8')
    expect(ormIndex).toContain("from './model-types'")
  })
})

// ─── 17. BaseOrm has all static query methods ────────────────────────

describe('BaseOrm has all static query methods (inherited by models)', () => {
  const baseContent = readFileSync(baseOrmFile, 'utf-8')

  test('BaseOrm is a generic class with T, C, J parameters', () => {
    expect(baseContent).toContain('class BaseOrm<T, C, J>')
  })

  test('BaseOrm has static select()', () => {
    expect(baseContent).toMatch(/static select\(/)
  })

  test('BaseOrm has static where()', () => {
    expect(baseContent).toMatch(/static where\(/)
  })

  test('BaseOrm has static find()', () => {
    expect(baseContent).toMatch(/static async find\(/)
  })

  test('BaseOrm has static first()', () => {
    expect(baseContent).toMatch(/static async first\(/)
  })

  test('BaseOrm has static last()', () => {
    expect(baseContent).toMatch(/static async last\(/)
  })

  test('BaseOrm has static all()', () => {
    expect(baseContent).toMatch(/static async all\(/)
  })

  test('BaseOrm has static orderBy()', () => {
    expect(baseContent).toMatch(/static orderBy\(/)
  })

  test('BaseOrm has static orderByAsc()', () => {
    expect(baseContent).toMatch(/static orderByAsc\(/)
  })

  test('BaseOrm has static orderByDesc()', () => {
    expect(baseContent).toMatch(/static orderByDesc\(/)
  })

  test('BaseOrm has static whereNull()', () => {
    expect(baseContent).toMatch(/static whereNull\(/)
  })

  test('BaseOrm has static whereNotNull()', () => {
    expect(baseContent).toMatch(/static whereNotNull\(/)
  })

  test('BaseOrm has static whereIn()', () => {
    expect(baseContent).toMatch(/static whereIn\(/)
  })

  test('BaseOrm has static whereNotIn()', () => {
    expect(baseContent).toMatch(/static whereNotIn\(/)
  })

  test('BaseOrm has static whereBetween()', () => {
    expect(baseContent).toMatch(/static whereBetween\(/)
  })

  test('BaseOrm has static whereLike()', () => {
    expect(baseContent).toMatch(/static whereLike\(/)
  })

  test('BaseOrm has static orWhere()', () => {
    expect(baseContent).toMatch(/static orWhere\(/)
  })

  test('BaseOrm has static with()', () => {
    expect(baseContent).toMatch(/static with\(/)
  })

  test('BaseOrm has static groupBy()', () => {
    expect(baseContent).toMatch(/static groupBy\(/)
  })

  test('BaseOrm has static having()', () => {
    expect(baseContent).toMatch(/static having\(/)
  })

  test('BaseOrm has static inRandomOrder()', () => {
    expect(baseContent).toMatch(/static inRandomOrder\(/)
  })

  test('BaseOrm has static distinct()', () => {
    expect(baseContent).toMatch(/static distinct\(/)
  })

  test('BaseOrm has static join()', () => {
    expect(baseContent).toMatch(/static join\(/)
  })

  test('BaseOrm has static max/min/avg/sum()', () => {
    expect(baseContent).toMatch(/static async max\(/)
    expect(baseContent).toMatch(/static async min\(/)
    expect(baseContent).toMatch(/static async avg\(/)
    expect(baseContent).toMatch(/static async sum\(/)
  })

  test('BaseOrm has static skip() and take()', () => {
    expect(baseContent).toMatch(/static skip\(/)
    expect(baseContent).toMatch(/static take\(/)
  })

  test('BaseOrm has static findOrFail()', () => {
    expect(baseContent).toMatch(/static async findOrFail\(/)
  })

  test('BaseOrm has static findMany()', () => {
    expect(baseContent).toMatch(/static async findMany\(/)
  })

  test('BaseOrm has static latest() and oldest()', () => {
    expect(baseContent).toMatch(/static async latest\(/)
    expect(baseContent).toMatch(/static async oldest\(/)
  })
})

// ─── 18. Generated model files do NOT have static query wrappers ─────

describe('generated model files inherit (not duplicate) static query methods', () => {
  const modelFiles = getModelFiles()

  test('should have model files to test', () => {
    expect(modelFiles.length).toBeGreaterThan(0)
  })

  for (const file of modelFiles) {
    const modelName = file.replace('.ts', '')
    const content = readFileSync(join(modelsDir, file), 'utf-8')

    test(`${modelName} model extends BaseOrm`, () => {
      expect(content).toContain(`extends BaseOrm<`)
    })

    test(`${modelName} model does NOT have static where()`, () => {
      // Generic static where should be inherited from BaseOrm
      expect(content).not.toMatch(/static where\(column:/)
    })

    test(`${modelName} model does NOT have static find()`, () => {
      expect(content).not.toMatch(/static (async )?find\(id:/)
    })

    test(`${modelName} model does NOT have static first()`, () => {
      expect(content).not.toMatch(/static (async )?first\(\)/)
    })

    test(`${modelName} model does NOT have static last()`, () => {
      expect(content).not.toMatch(/static (async )?last\(\)/)
    })

    test(`${modelName} model does NOT have static select() overloads`, () => {
      // Should not have typed select overloads — inherited from BaseOrm
      expect(content).not.toMatch(/static select<K extends keyof/)
      expect(content).not.toMatch(/static select\(params: RawBuilder/)
    })

    test(`${modelName} model does NOT have static orderBy()`, () => {
      expect(content).not.toMatch(/static orderBy\(column:/)
    })

    test(`${modelName} model does NOT have static all()`, () => {
      expect(content).not.toMatch(/static (async )?all\(\)/)
    })

    test(`${modelName} model does NOT import Operator or SelectedQuery`, () => {
      expect(content).not.toContain("import type { Operator, SelectedQuery } from '@stacksjs/orm'")
      expect(content).not.toContain("import type { Operator } from '@stacksjs/orm'")
      expect(content).not.toContain("import type { SelectedQuery } from '@stacksjs/orm'")
    })
  }
})
