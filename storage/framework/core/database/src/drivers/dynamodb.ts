/**
 * DynamoDB Driver for Stacks
 *
 * Entity-centric API for DynamoDB single-table design.
 * Integrates with bun-query-builder's DynamoDB module.
 *
 * @example
 * ```typescript
 * import { dynamo } from '@stacksjs/database'
 *
 * // Configure connection
 * dynamo.connection({
 *   region: 'us-east-1',
 *   table: 'MyApp',
 * })
 *
 * // Entity-centric queries
 * const users = await dynamo.entity('User')
 *   .pk('USER#123')
 *   .sk.beginsWith('PROFILE#')
 *   .index('GSI1')
 *   .project('name', 'email')
 *   .get()
 * ```
 */

import type { Model } from '@stacksjs/types'

// ============================================================================
// Types
// ============================================================================

/**
 * DynamoDB connection configuration
 */
export interface DynamoConnectionConfig {
  /** AWS region */
  region: string
  /** Table name (single table design) */
  table: string
  /** DynamoDB endpoint (for local development) */
  endpoint?: string
  /** AWS credentials */
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
  /** Partition key attribute name (default: 'pk') */
  pkAttribute?: string
  /** Sort key attribute name (default: 'sk') */
  skAttribute?: string
  /** Entity type attribute name (default: '_et') */
  entityTypeAttribute?: string
  /** Key delimiter (default: '#') */
  keyDelimiter?: string
}

/**
 * Entity mapping for single-table design
 */
export interface SingleTableEntityMapping {
  /** Entity type identifier */
  entityType: string
  /** Partition key pattern, e.g., 'USER#{id}' */
  pkPattern: string
  /** Sort key pattern, e.g., 'USER#{id}' */
  skPattern?: string
  /** GSI1 partition key pattern */
  gsi1pk?: string
  /** GSI1 sort key pattern */
  gsi1sk?: string
  /** GSI2 partition key pattern */
  gsi2pk?: string
  /** GSI2 sort key pattern */
  gsi2sk?: string
}

/**
 * Sort key builder for fluent API
 */
export interface SortKeyBuilder {
  /** Sort key equals value */
  equals(value: string): EntityQueryBuilder
  /** Sort key begins with prefix */
  beginsWith(prefix: string): EntityQueryBuilder
  /** Sort key between two values */
  between(start: string, end: string): EntityQueryBuilder
  /** Sort key less than value */
  lt(value: string): EntityQueryBuilder
  /** Sort key less than or equal to value */
  lte(value: string): EntityQueryBuilder
  /** Sort key greater than value */
  gt(value: string): EntityQueryBuilder
  /** Sort key greater than or equal to value */
  gte(value: string): EntityQueryBuilder
}

/**
 * Batch write operation
 */
export interface BatchWriteOperation {
  put?: { entity: string, item: Record<string, any> }
  delete?: { entity: string, pk: string, sk: string }
}

/**
 * Transact write operation
 */
export interface TransactWriteOperation {
  put?: { entity: string, item: Record<string, any>, condition?: string }
  update?: { entity: string, pk: string, sk?: string, set?: Record<string, any>, add?: Record<string, number>, remove?: string[] }
  delete?: { entity: string, pk: string, sk: string, condition?: string }
  conditionCheck?: { entity: string, pk: string, sk: string, condition: string }
}

/**
 * Query result
 */
export interface QueryResult<T = any> {
  items: T[]
  count: number
  scannedCount?: number
  lastKey?: Record<string, any>
}

// ============================================================================
// Marshall/Unmarshall Utilities
// ============================================================================

/**
 * Convert JS value to DynamoDB AttributeValue
 */
function toDynamoValue(value: any): Record<string, any> {
  if (value === null || value === undefined) {
    return { NULL: true }
  }
  if (typeof value === 'string') {
    return { S: value }
  }
  if (typeof value === 'number') {
    return { N: String(value) }
  }
  if (typeof value === 'boolean') {
    return { BOOL: value }
  }
  if (Array.isArray(value)) {
    return { L: value.map(v => toDynamoValue(v)) }
  }
  if (typeof value === 'object') {
    const m: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      m[k] = toDynamoValue(v)
    }
    return { M: m }
  }
  return { S: String(value) }
}

/**
 * Convert DynamoDB AttributeValue to JS value
 */
function fromDynamoValue(attr: Record<string, any>): any {
  if (attr.NULL)
    return null
  if (attr.S !== undefined)
    return attr.S
  if (attr.N !== undefined)
    return Number(attr.N)
  if (attr.BOOL !== undefined)
    return attr.BOOL
  if (attr.L !== undefined)
    return attr.L.map((v: any) => fromDynamoValue(v))
  if (attr.M !== undefined) {
    const obj: Record<string, any> = {}
    for (const [k, v] of Object.entries(attr.M)) {
      obj[k] = fromDynamoValue(v as Record<string, any>)
    }
    return obj
  }
  if (attr.SS !== undefined)
    return attr.SS
  if (attr.NS !== undefined)
    return attr.NS.map((n: string) => Number(n))
  if (attr.B !== undefined)
    return attr.B
  if (attr.BS !== undefined)
    return attr.BS
  return null
}

/**
 * Marshall a JS object to DynamoDB format
 */
function marshall(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = toDynamoValue(value)
  }
  return result
}

/**
 * Unmarshall a DynamoDB object to JS format
 */
function unmarshall(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = fromDynamoValue(value)
  }
  return result
}

// ============================================================================
// Entity Query Builder
// ============================================================================

/**
 * Entity-centric query builder for DynamoDB
 */
export class EntityQueryBuilder<T = any> {
  private client: any
  private tableName: string
  private pkAttribute: string
  private skAttribute: string
  private entityTypeAttr: string
  private delimiter: string

  private _entityType?: string
  private _pkValue?: string
  private _skCondition?: { type: 'eq' | 'begins_with' | 'between' | 'lt' | 'lte' | 'gt' | 'gte', value: string, value2?: string }
  private _indexName?: string
  private _projectionAttrs: string[] = []
  private _filterConditions: Array<{ attribute: string, operator: string, value?: any, values?: any[] }> = []
  private _limitValue?: number
  private _scanForward: boolean = true
  private _consistentRead: boolean = false
  private _startKey?: Record<string, any>

  constructor(
    client: any,
    tableName: string,
    config: { pkAttribute: string, skAttribute: string, entityTypeAttribute: string, keyDelimiter: string },
  ) {
    this.client = client
    this.tableName = tableName
    this.pkAttribute = config.pkAttribute
    this.skAttribute = config.skAttribute
    this.entityTypeAttr = config.entityTypeAttribute
    this.delimiter = config.keyDelimiter
  }

  /**
   * Set entity type for the query
   */
  entity(entityType: string): this {
    this._entityType = entityType
    return this
  }

  /**
   * Set partition key value
   */
  pk(value: string): this {
    this._pkValue = value
    return this
  }

  /**
   * Sort key builder
   */
  get sk(): SortKeyBuilder {
    const self = this
    return {
      equals(value: string): EntityQueryBuilder {
        self._skCondition = { type: 'eq', value }
        return self
      },
      beginsWith(prefix: string): EntityQueryBuilder {
        self._skCondition = { type: 'begins_with', value: prefix }
        return self
      },
      between(start: string, end: string): EntityQueryBuilder {
        self._skCondition = { type: 'between', value: start, value2: end }
        return self
      },
      lt(value: string): EntityQueryBuilder {
        self._skCondition = { type: 'lt', value }
        return self
      },
      lte(value: string): EntityQueryBuilder {
        self._skCondition = { type: 'lte', value }
        return self
      },
      gt(value: string): EntityQueryBuilder {
        self._skCondition = { type: 'gt', value }
        return self
      },
      gte(value: string): EntityQueryBuilder {
        self._skCondition = { type: 'gte', value }
        return self
      },
    }
  }

  /**
   * Use a specific index (GSI or LSI)
   */
  index(indexName: string): this {
    this._indexName = indexName
    return this
  }

  /**
   * Project specific attributes
   */
  project(...attributes: string[]): this {
    this._projectionAttrs.push(...attributes)
    return this
  }

  /**
   * Add a filter condition
   */
  filter(attribute: string, operator: string, value?: any): this {
    this._filterConditions.push({ attribute, operator, value })
    return this
  }

  /**
   * Filter where attribute equals value
   */
  where(attribute: string, value: any): this {
    return this.filter(attribute, '=', value)
  }

  /**
   * Filter where attribute is in list
   */
  whereIn(attribute: string, values: any[]): this {
    this._filterConditions.push({ attribute, operator: 'IN', values })
    return this
  }

  /**
   * Limit results
   */
  limit(count: number): this {
    this._limitValue = count
    return this
  }

  /**
   * Sort ascending (default)
   */
  asc(): this {
    this._scanForward = true
    return this
  }

  /**
   * Sort descending
   */
  desc(): this {
    this._scanForward = false
    return this
  }

  /**
   * Use consistent read
   */
  consistent(): this {
    this._consistentRead = true
    return this
  }

  /**
   * Start from a specific key (for pagination)
   */
  startFrom(key: Record<string, any>): this {
    this._startKey = key
    return this
  }

  /**
   * Build the DynamoDB Query request
   */
  toRequest(): Record<string, any> {
    const request: Record<string, any> = {
      TableName: this.tableName,
    }

    if (this._indexName) {
      request.IndexName = this._indexName
    }

    // Build key condition expression
    const keyConditions: string[] = []
    const exprNames: Record<string, string> = {}
    const exprValues: Record<string, any> = {}
    let idx = 0

    if (this._pkValue) {
      const nameKey = `#pk${idx}`
      const valueKey = `:pk${idx}`
      exprNames[nameKey] = this.pkAttribute
      exprValues[valueKey] = { S: this._pkValue }
      keyConditions.push(`${nameKey} = ${valueKey}`)
      idx++
    }

    if (this._skCondition) {
      const nameKey = `#sk${idx}`
      exprNames[nameKey] = this.skAttribute

      switch (this._skCondition.type) {
        case 'eq': {
          const valueKey = `:sk${idx}`
          exprValues[valueKey] = { S: this._skCondition.value }
          keyConditions.push(`${nameKey} = ${valueKey}`)
          break
        }
        case 'begins_with': {
          const valueKey = `:sk${idx}`
          exprValues[valueKey] = { S: this._skCondition.value }
          keyConditions.push(`begins_with(${nameKey}, ${valueKey})`)
          break
        }
        case 'between': {
          const valueKey1 = `:sk${idx}a`
          const valueKey2 = `:sk${idx}b`
          exprValues[valueKey1] = { S: this._skCondition.value }
          exprValues[valueKey2] = { S: this._skCondition.value2 }
          keyConditions.push(`${nameKey} BETWEEN ${valueKey1} AND ${valueKey2}`)
          break
        }
        case 'lt': {
          const valueKey = `:sk${idx}`
          exprValues[valueKey] = { S: this._skCondition.value }
          keyConditions.push(`${nameKey} < ${valueKey}`)
          break
        }
        case 'lte': {
          const valueKey = `:sk${idx}`
          exprValues[valueKey] = { S: this._skCondition.value }
          keyConditions.push(`${nameKey} <= ${valueKey}`)
          break
        }
        case 'gt': {
          const valueKey = `:sk${idx}`
          exprValues[valueKey] = { S: this._skCondition.value }
          keyConditions.push(`${nameKey} > ${valueKey}`)
          break
        }
        case 'gte': {
          const valueKey = `:sk${idx}`
          exprValues[valueKey] = { S: this._skCondition.value }
          keyConditions.push(`${nameKey} >= ${valueKey}`)
          break
        }
      }
      idx++
    }

    if (keyConditions.length > 0) {
      request.KeyConditionExpression = keyConditions.join(' AND ')
    }

    // Build filter expression
    if (this._filterConditions.length > 0) {
      const filterParts: string[] = []
      for (const cond of this._filterConditions) {
        const nameKey = `#flt${idx}`
        exprNames[nameKey] = cond.attribute

        if (cond.operator === 'IN' && cond.values) {
          const valueKeys = cond.values.map((_, i) => `:flt${idx}_${i}`)
          cond.values.forEach((val, i) => {
            exprValues[`:flt${idx}_${i}`] = marshall({ v: val }).v
          })
          filterParts.push(`${nameKey} IN (${valueKeys.join(', ')})`)
        }
        else {
          const valueKey = `:flt${idx}`
          exprValues[valueKey] = marshall({ v: cond.value }).v
          filterParts.push(`${nameKey} ${cond.operator} ${valueKey}`)
        }
        idx++
      }
      request.FilterExpression = filterParts.join(' AND ')
    }

    // Build projection expression
    if (this._projectionAttrs.length > 0) {
      const projParts: string[] = []
      for (const attr of this._projectionAttrs) {
        const nameKey = `#proj${idx}`
        exprNames[nameKey] = attr
        projParts.push(nameKey)
        idx++
      }
      request.ProjectionExpression = projParts.join(', ')
    }

    if (Object.keys(exprNames).length > 0) {
      request.ExpressionAttributeNames = exprNames
    }
    if (Object.keys(exprValues).length > 0) {
      request.ExpressionAttributeValues = exprValues
    }

    if (this._limitValue !== undefined) {
      request.Limit = this._limitValue
    }

    request.ScanIndexForward = this._scanForward

    if (this._consistentRead) {
      request.ConsistentRead = true
    }

    if (this._startKey) {
      request.ExclusiveStartKey = marshall(this._startKey)
    }

    return request
  }

  /**
   * Execute query and return results
   */
  async get(): Promise<T[]> {
    if (!this.client) {
      throw new Error('DynamoDB client not configured. Call dynamo.connection() first.')
    }

    const request = this.toRequest()

    // Use Query if we have key conditions, otherwise Scan
    const isQuery = this._pkValue !== undefined
    const response = isQuery
      ? await this.client.query(request)
      : await this.client.scan(request)

    return (response.Items ?? []).map((item: any) => unmarshall(item)) as T[]
  }

  /**
   * Get first result
   */
  async first(): Promise<T | undefined> {
    this._limitValue = 1
    const results = await this.get()
    return results[0]
  }

  /**
   * Get all results (auto-paginate)
   */
  async getAll(): Promise<T[]> {
    const allItems: T[] = []
    let lastKey: Record<string, any> | undefined

    do {
      if (lastKey) {
        this._startKey = lastKey
      }

      const request = this.toRequest()
      const isQuery = this._pkValue !== undefined
      const response = isQuery
        ? await this.client.query(request)
        : await this.client.scan(request)

      const items = (response.Items ?? []).map((item: any) => unmarshall(item)) as T[]
      allItems.push(...items)

      lastKey = response.LastEvaluatedKey
        ? unmarshall(response.LastEvaluatedKey)
        : undefined
    } while (lastKey)

    return allItems
  }

  /**
   * Count matching items
   */
  async count(): Promise<number> {
    if (!this.client) {
      throw new Error('DynamoDB client not configured. Call dynamo.connection() first.')
    }

    const request = this.toRequest()
    request.Select = 'COUNT'

    const isQuery = this._pkValue !== undefined
    const response = isQuery
      ? await this.client.query(request)
      : await this.client.scan(request)

    return response.Count ?? 0
  }
}

// ============================================================================
// Dynamo Client
// ============================================================================

/**
 * DynamoDB client with entity-centric API
 */
class DynamoClient {
  private client?: any
  private tableName: string = ''
  private pkAttribute: string = 'pk'
  private skAttribute: string = 'sk'
  private entityTypeAttr: string = '_et'
  private delimiter: string = '#'
  private entityMappings: Map<string, SingleTableEntityMapping> = new Map()
  private _configured: boolean = false

  /**
   * Configure DynamoDB connection
   */
  connection(config: DynamoConnectionConfig): this {
    this.tableName = config.table
    this.pkAttribute = config.pkAttribute ?? 'pk'
    this.skAttribute = config.skAttribute ?? 'sk'
    this.entityTypeAttr = config.entityTypeAttribute ?? '_et'
    this.delimiter = config.keyDelimiter ?? '#'
    this._configured = true

    return this
  }

  /**
   * Check if the client is configured
   */
  isConfigured(): boolean {
    return this._configured
  }

  /**
   * Set the AWS SDK DynamoDB client
   */
  setClient(client: any): this {
    this.client = client
    return this
  }

  /**
   * Get the AWS SDK DynamoDB client
   */
  getClient(): any {
    return this.client
  }

  /**
   * Register an entity mapping for single table design
   */
  registerEntity(mapping: SingleTableEntityMapping): this {
    this.entityMappings.set(mapping.entityType, mapping)
    return this
  }

  /**
   * Register entity mappings from a Stacks Model
   */
  registerModel(model: Model): this {
    const name = model.name ?? 'Unknown'
    const upperName = name.toUpperCase()

    const mapping: SingleTableEntityMapping = {
      entityType: name,
      pkPattern: `${upperName}#{id}`,
      skPattern: `${upperName}#{id}`,
    }

    this.entityMappings.set(name, mapping)
    return this
  }

  /**
   * Get entity mapping
   */
  getEntityMapping(entityType: string): SingleTableEntityMapping | undefined {
    return this.entityMappings.get(entityType)
  }

  /**
   * Start an entity-centric query
   */
  entity<T = any>(entityType: string): EntityQueryBuilder<T> {
    if (!this._configured) {
      throw new Error('DynamoDB not configured. Call dynamo.connection() first.')
    }

    const builder = new EntityQueryBuilder<T>(
      this.client,
      this.tableName,
      {
        pkAttribute: this.pkAttribute,
        skAttribute: this.skAttribute,
        entityTypeAttribute: this.entityTypeAttr,
        keyDelimiter: this.delimiter,
      },
    )

    return builder.entity(entityType)
  }

  /**
   * Batch write operations
   */
  async batchWrite(operations: BatchWriteOperation[]): Promise<void> {
    if (!this.client) {
      throw new Error('DynamoDB client not configured. Call setClient() first.')
    }
    if (!this._configured) {
      throw new Error('DynamoDB not configured. Call dynamo.connection() first.')
    }

    const requestItems: any[] = []

    for (const op of operations) {
      if (op.put) {
        const item = {
          ...op.put.item,
          [this.entityTypeAttr]: op.put.entity,
        }
        requestItems.push({
          PutRequest: {
            Item: marshall(item),
          },
        })
      }
      else if (op.delete) {
        requestItems.push({
          DeleteRequest: {
            Key: marshall({
              [this.pkAttribute]: op.delete.pk,
              [this.skAttribute]: op.delete.sk,
            }),
          },
        })
      }
    }

    if (requestItems.length > 0) {
      await this.client.batchWriteItem({
        RequestItems: {
          [this.tableName]: requestItems,
        },
      })
    }
  }

  /**
   * Transactional write operations
   */
  async transactWrite(operations: TransactWriteOperation[]): Promise<void> {
    if (!this.client) {
      throw new Error('DynamoDB client not configured. Call setClient() first.')
    }
    if (!this._configured) {
      throw new Error('DynamoDB not configured. Call dynamo.connection() first.')
    }

    const transactItems: any[] = []

    for (const op of operations) {
      if (op.put) {
        const item = {
          ...op.put.item,
          [this.entityTypeAttr]: op.put.entity,
        }
        const transactItem: any = {
          Put: {
            TableName: this.tableName,
            Item: marshall(item),
          },
        }
        if (op.put.condition) {
          transactItem.Put.ConditionExpression = op.put.condition
        }
        transactItems.push(transactItem)
      }
      else if (op.update) {
        const key: Record<string, any> = {
          [this.pkAttribute]: op.update.pk,
        }
        if (op.update.sk) {
          key[this.skAttribute] = op.update.sk
        }

        const updateParts: string[] = []
        const exprNames: Record<string, string> = {}
        const exprValues: Record<string, any> = {}
        let idx = 0

        if (op.update.set) {
          const setParts: string[] = []
          for (const [attr, value] of Object.entries(op.update.set)) {
            const nameKey = `#set${idx}`
            const valueKey = `:set${idx}`
            exprNames[nameKey] = attr
            exprValues[valueKey] = marshall({ v: value }).v
            setParts.push(`${nameKey} = ${valueKey}`)
            idx++
          }
          if (setParts.length > 0) {
            updateParts.push(`SET ${setParts.join(', ')}`)
          }
        }

        if (op.update.add) {
          const addParts: string[] = []
          for (const [attr, value] of Object.entries(op.update.add)) {
            const nameKey = `#add${idx}`
            const valueKey = `:add${idx}`
            exprNames[nameKey] = attr
            exprValues[valueKey] = { N: String(value) }
            addParts.push(`${nameKey} ${valueKey}`)
            idx++
          }
          if (addParts.length > 0) {
            updateParts.push(`ADD ${addParts.join(', ')}`)
          }
        }

        if (op.update.remove && op.update.remove.length > 0) {
          const removeParts: string[] = []
          for (const attr of op.update.remove) {
            const nameKey = `#rem${idx}`
            exprNames[nameKey] = attr
            removeParts.push(nameKey)
            idx++
          }
          updateParts.push(`REMOVE ${removeParts.join(', ')}`)
        }

        transactItems.push({
          Update: {
            TableName: this.tableName,
            Key: marshall(key),
            UpdateExpression: updateParts.join(' '),
            ExpressionAttributeNames: exprNames,
            ExpressionAttributeValues: exprValues,
          },
        })
      }
      else if (op.delete) {
        const transactItem: any = {
          Delete: {
            TableName: this.tableName,
            Key: marshall({
              [this.pkAttribute]: op.delete.pk,
              [this.skAttribute]: op.delete.sk,
            }),
          },
        }
        if (op.delete.condition) {
          transactItem.Delete.ConditionExpression = op.delete.condition
        }
        transactItems.push(transactItem)
      }
      else if (op.conditionCheck) {
        transactItems.push({
          ConditionCheck: {
            TableName: this.tableName,
            Key: marshall({
              [this.pkAttribute]: op.conditionCheck.pk,
              [this.skAttribute]: op.conditionCheck.sk,
            }),
            ConditionExpression: op.conditionCheck.condition,
          },
        })
      }
    }

    if (transactItems.length > 0) {
      await this.client.transactWriteItems({
        TransactItems: transactItems,
      })
    }
  }

  /**
   * Put a single item
   */
  async put(entity: string, item: Record<string, any>): Promise<void> {
    if (!this.client) {
      throw new Error('DynamoDB client not configured. Call setClient() first.')
    }

    const fullItem = {
      ...item,
      [this.entityTypeAttr]: entity,
    }

    await this.client.putItem({
      TableName: this.tableName,
      Item: marshall(fullItem),
    })
  }

  /**
   * Get a single item by key
   */
  async get<T = any>(pk: string, sk?: string): Promise<T | undefined> {
    if (!this.client) {
      throw new Error('DynamoDB client not configured. Call setClient() first.')
    }

    const key: Record<string, any> = {
      [this.pkAttribute]: pk,
    }
    if (sk) {
      key[this.skAttribute] = sk
    }

    const response = await this.client.getItem({
      TableName: this.tableName,
      Key: marshall(key),
    })

    if (!response.Item) {
      return undefined
    }

    return unmarshall(response.Item) as T
  }

  /**
   * Delete a single item by key
   */
  async delete(pk: string, sk?: string): Promise<void> {
    if (!this.client) {
      throw new Error('DynamoDB client not configured. Call setClient() first.')
    }

    const key: Record<string, any> = {
      [this.pkAttribute]: pk,
    }
    if (sk) {
      key[this.skAttribute] = sk
    }

    await this.client.deleteItem({
      TableName: this.tableName,
      Key: marshall(key),
    })
  }

  /**
   * Update a single item
   */
  async update(pk: string, sk: string | undefined, updates: Record<string, any>): Promise<void> {
    if (!this.client) {
      throw new Error('DynamoDB client not configured. Call setClient() first.')
    }

    const key: Record<string, any> = {
      [this.pkAttribute]: pk,
    }
    if (sk) {
      key[this.skAttribute] = sk
    }

    const updateParts: string[] = []
    const exprNames: Record<string, string> = {}
    const exprValues: Record<string, any> = {}
    let idx = 0

    const setParts: string[] = []
    for (const [attr, value] of Object.entries(updates)) {
      const nameKey = `#upd${idx}`
      const valueKey = `:upd${idx}`
      exprNames[nameKey] = attr
      exprValues[valueKey] = marshall({ v: value }).v
      setParts.push(`${nameKey} = ${valueKey}`)
      idx++
    }

    if (setParts.length > 0) {
      updateParts.push(`SET ${setParts.join(', ')}`)
    }

    await this.client.updateItem({
      TableName: this.tableName,
      Key: marshall(key),
      UpdateExpression: updateParts.join(' '),
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
    })
  }

  /**
   * Get table name
   */
  getTableName(): string {
    return this.tableName
  }

  /**
   * Get configuration
   */
  getConfig(): {
    tableName: string
    pkAttribute: string
    skAttribute: string
    entityTypeAttribute: string
    keyDelimiter: string
  } {
    return {
      tableName: this.tableName,
      pkAttribute: this.pkAttribute,
      skAttribute: this.skAttribute,
      entityTypeAttribute: this.entityTypeAttr,
      keyDelimiter: this.delimiter,
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate key pattern for an entity
 */
export function generateKeyPattern(entityName: string, idField: string = 'id'): string {
  return `${entityName.toUpperCase()}#{${idField}}`
}

/**
 * Parse a key pattern and extract values
 */
export function parseKeyPattern(pattern: string, key: string): Record<string, string> {
  const result: Record<string, string> = {}
  const patternParts = pattern.split('#')
  const keyParts = key.split('#')

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]
    const keyPart = keyParts[i]

    if (patternPart?.startsWith('{') && patternPart.endsWith('}')) {
      const fieldName = patternPart.slice(1, -1)
      result[fieldName] = keyPart ?? ''
    }
  }

  return result
}

/**
 * Build a key from a pattern and values
 */
export function buildKey(pattern: string, values: Record<string, string>): string {
  let key = pattern
  for (const [field, value] of Object.entries(values)) {
    key = key.replace(`{${field}}`, value)
  }
  return key
}

// ============================================================================
// Exports
// ============================================================================

/**
 * DynamoDB client singleton
 */
export const dynamo = new DynamoClient()

/**
 * Create a new DynamoDB client instance
 */
export function createDynamo(): DynamoClient {
  return new DynamoClient()
}

// Export marshall/unmarshall utilities
export { marshall, unmarshall }
