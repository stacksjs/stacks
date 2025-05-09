import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

export class BaseOrm<T, C, J> {
  protected tableName: string

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected withRelations: string[]
  protected hasSelect: boolean = false

  constructor(tableName: string) {
    this.tableName = tableName
    // TODO: bring back new instantiation from the this parent class
    this.selectFromQuery = DB.instance.selectFrom(this.tableName)
    this.updateFromQuery = DB.instance.updateTable(this.tableName)
    this.deleteFromQuery = DB.instance.deleteFrom(this.tableName)

    this.withRelations = []
  }

  applySelect(params: (keyof J)[] | RawBuilder<string> | string): this {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  select(params: (keyof J)[] | RawBuilder<string> | string): this {
    return this.applySelect(params)
  }

  async first(): Promise<T | undefined> {
    const model = await this.applyFirst()

    if (!model)
      return undefined

    return model as T
  }

  async firstOrFail(): Promise<T> {
    const model = await this.applyFirstOrFail()

    if (!model)
      throw new HttpError(404, `No ${this.tableName} results found for query`)

    return model as T
  }

  protected async applyFirstOrFail(): Promise<T | undefined> {
    let model

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    if (!model)
      throw new HttpError(404, `No ${this.tableName} results found for query`)

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    return model
  }

  // The protected helper method that does the actual work
  protected async applyFind(id: number): Promise<T | undefined> {
    const model = await DB.instance.selectFrom(this.tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)

    await this.loadRelations(model)

    // cache.getOrSet(`${this.tableName}:${id}`, JSON.stringify(model))

    return model
  }

  async applyFindMany(ids: number[]): Promise<T[]> {
    let query = DB.instance.selectFrom('users').where('id', 'in', ids)

    query = query.selectAll()

    // TODO: Properly implement soft deletes

    const models = await query.execute()

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    return models
  }

  async findMany(ids: number[]): Promise<T[]> {
    return await this.applyFindMany(ids)
  }

  async all(): Promise<T[]> {
    const models = await DB.instance.selectFrom(this.tableName)
      .selectAll()
      .execute()

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    return models as T[]
  }

  async applyFirst(): Promise<T | undefined> {
    let model

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    return model
  }

  applyWhere<V>(column: keyof C, ...args: [V] | [Operator, V]): this {
    if (args.length === 1) {
      const [value] = args
      this.selectFromQuery = this.selectFromQuery.where(column, '=', value)
      this.updateFromQuery = this.updateFromQuery.where(column, '=', value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, '=', value)
    }
    else {
      const [operator, value] = args as [Operator, V]
      this.selectFromQuery = this.selectFromQuery.where(column, operator, value)
      this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)
    }

    return this
  }

  where<V = string>(column: keyof C, ...args: [V] | [Operator, V]): this {
    return this.applyWhere<V>(column, ...args)
  }

  async find(id: number): Promise<T | undefined> {
    return await this.applyFind(id)
  }

  async findOrFail(id: number): Promise<T> {
    const model = await this.applyFindOrFail(id)

    if (!model)
      throw new HttpError(404, `No ${this.tableName} results found for id ${id}`)

    return model as T
  }

  protected async applyFindOrFail(id: number): Promise<T | undefined> {
    const model = await DB.instance.selectFrom(this.tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!model)
      throw new HttpError(404, `No ${this.tableName} results found for id ${id}`)

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    // cache.getOrSet(`${this.tableName}:${id}`, JSON.stringify(model))

    return model
  }

  applyWhereColumn(first: keyof C, operator: Operator, second: keyof C): this {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  whereColumn(first: keyof C, operator: Operator, second: keyof C): this {
    return this.applyWhereColumn(first, operator, second)
  }

  applyWhereRef(column: keyof C, ...args: string[]): this {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    this.selectFromQuery = this.selectFromQuery.whereRef(column, operator, actualValue)

    return this
  }

  whereRef(column: keyof C, ...args: string[]): this {
    return this.applyWhereRef(column, ...args)
  }

  applyWhereRaw(sqlStatement: string): this {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  whereRaw(sqlStatement: string): this {
    return this.applyWhereRaw(sqlStatement)
  }

  applyOrWhere(...conditions: [string, any][]): this {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.updateFromQuery = this.updateFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    return this
  }

  orWhere(...conditions: [string, any][]): this {
    return this.applyOrWhere(...conditions)
  }

  applyWhen(condition: boolean, callback: (query: this) => T): this {
    if (condition)
      callback(this)

    return this
  }

  when(condition: boolean, callback: (query: this) => T,
  ): this {
    return this.applyWhen(condition, callback)
  }

  applyWhereNotNull(column: keyof C): this {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return this
  }

  whereNotNull(column: keyof C): this {
    return this.applyWhereNotNull(column)
  }

  applyWhereNull(column: keyof C): this {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  whereNull(column: keyof C): this {
    return this.applyWhereNull(column)
  }

  applyWhereIn<V>(column: keyof C, values: V[]): this {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof C, values: V[]): this {
    return this.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof C, range: [V, V]): this {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof C, range: [V, V]): this {
    return this.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof C, value: string): this {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof C, value: string): this {
    return this.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof C, values: V[]): this {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof C, values: V[]): this {
    return this.applyWhereNotIn<V>(column, values)
  }

  async exists(): Promise<boolean> {
    let model

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    return model !== null && model !== undefined
  }

  applyWith(relations: string[]): this {
    this.withRelations = relations

    return this
  }

  with(relations: string[]): this {
    return this.applyWith(relations)
  }

  async applyLast(): Promise<T | undefined> {
    let model

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().orderBy('id', 'desc').executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    return model
  }

  async last(): Promise<T | undefined> {
    const model = await this.applyLast()

    if (!model)
      return undefined

    return model as T
  }

  async applyGet(): Promise<T[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    return models as T[]
  }

  async get(): Promise<T[]> {
    return await this.applyGet()
  }

  applySkip(count: number): this {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  skip(count: number): this {
    return this.applySkip(count)
  }

  applyTake(count: number): this {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  take(count: number): this {
    return this.applyTake(count)
  }

  async applyCount(): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  async count(): Promise<number> {
    return await this.applyCount()
  }

  applyOrderBy(column: keyof C, order: 'asc' | 'desc'): this {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  orderBy(column: keyof C, order: 'asc' | 'desc'): this {
    return this.applyOrderBy(column, order)
  }

  applyGroupBy(column: keyof C): this {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  groupBy(column: keyof C): this {
    return this.applyGroupBy(column)
  }

  applyHaving<V = string>(column: keyof C, operator: Operator, value: V): this {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  having<V = string>(column: keyof C, operator: Operator, value: V): this {
    return this.applyHaving<V>(column, operator, value)
  }

  applyOrderByDesc(column: keyof C): this {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  orderByDesc(column: keyof C): this {
    return this.applyOrderByDesc(column)
  }

  applyOrderByAsc(column: keyof C): this {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  orderByAsc(column: keyof C): this {
    return this.applyOrderByAsc(column)
  }

  applyDistinct(column: keyof J): this {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  distinct(column: keyof J): this {
    return this.applyDistinct(column)
  }

  applyJoin(table: string, firstCol: string, secondCol: string): this {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  join(table: string, firstCol: string, secondCol: string): this {
    return this.applyJoin(table, firstCol, secondCol)
  }

  async applyPluck<K extends keyof T>(field: K): Promise<T[K][]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    return models.map((model: T) => model[field])
  }

  async pluck<K extends keyof T>(field: K): Promise<T[K][]> {
    return await this.applyPluck(field)
  }

  applyInRandomOrder(): this {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  inRandomOrder(): this {
    return this.applyInRandomOrder()
  }

  applyWhereExists(callback: (qb: any) => any): this {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return this
  }

  whereExists(callback: (qb: any) => any): this {
    return this.applyWhereExists(callback)
  }

  applyHas(relation: string): this {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.${this.tableName.slice(0, -1)}_id`, '=', `${this.tableName}.id`),
      ),
    )

    return this
  }

  has(relation: string): this {
    return this.applyHas(relation)
  }

  applyDoesntHave(relation: string): this {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.${this.tableName.slice(0, -1)}_id`, '=', `${this.tableName}.id`),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): this {
    return this.applyDoesntHave(relation)
  }

  applyWhereHas(relation: string, callback: (query: any) => void): this {
    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.${this.tableName.slice(0, -1)}_id`, '=', `${this.tableName}.id`)

        // Apply the callback to the subquery
        callback(subquery)

        return exists(subquery)
      })

    return this
  }

  whereHas(relation: string, callback: (query: any) => void): this {
    return this.applyWhereHas(relation, callback)
  }

  applyWhereDoesntHave(relation: string, callback: (query: any) => void): this {
    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.${this.tableName.slice(0, -1)}_id`, '=', `${this.tableName}.id`)

        // Apply the callback to the subquery
        callback(subquery)

        return not(exists(subquery))
      })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: any) => void): this {
    return this.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{ data: T[], paging: { total_records: number, page: number, total_pages: number }, next_cursor: number | null }> {
    const totalRecordsResult = await DB.instance.selectFrom(this.tableName)
      .select(DB.instance.fn.count('id').as('total'))
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const modelsWithExtra = await DB.instance.selectFrom(this.tableName)
      .selectAll()
      .orderBy('id', 'asc')
      .limit((options.limit ?? 10) + 1)
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10))
      .execute()

    let nextCursor = null
    if (modelsWithExtra.length > (options.limit ?? 10))
      nextCursor = modelsWithExtra.pop()?.id ?? null

    this.mapCustomGetters(modelsWithExtra)
    await this.loadRelations(modelsWithExtra)

    return {
      data: modelsWithExtra as T[],
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{ data: T[], paging: { total_records: number, page: number, total_pages: number }, next_cursor: number | null }> {
    return await this.applyPaginate(options)
  }

  async applyMax(field: keyof C): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max || 0
  }

  async max(field: keyof C): Promise<number> {
    return await this.applyMax(field)
  }

  async applyMin(field: keyof C): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min`)
      .executeTakeFirst()

    return result.min || 0
  }

  async min(field: keyof C): Promise<number> {
    return await this.applyMin(field)
  }

  async applyAvg(field: keyof C): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg`)
      .executeTakeFirst()

    return result.avg || 0
  }

  async avg(field: keyof C): Promise<number> {
    return await this.applyAvg(field)
  }

  async applySum(field: keyof C): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum`)
      .executeTakeFirst()

    return Number(result?.sum) || 0
  }

  async sum(field: keyof C): Promise<number> {
    return await this.applySum(field)
  }

  async applyChunk(size: number, callback: (models: T[]) => Promise<void>): Promise<void> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      // Get one batch
      const models = await this.selectFromQuery
        .selectAll()
        .limit(size)
        .offset((page - 1) * size)
        .execute()

      // If we got fewer results than chunk size, this is the last batch
      if (models.length < size) {
        hasMore = false
      }

      // Process this batch
      if (models.length > 0) {
        await callback(models)
      }

      page++
    }
  }

  async chunk(size: number, callback: (models: T[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  isDirty(column?: keyof T): boolean {
    if (!('attributes' in this) || !('originalAttributes' in this)) {
      throw new Error('Child class must define attributes and originalAttributes properties')
    }

    if (column) {
      return (this as any).attributes[column as string] !== (this as any).originalAttributes[column as string]
    }

    return Object.entries((this as any).originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this as any).attributes[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof T): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof T): boolean {
    if (!('hasSaved' in this)) {
      throw new Error('Child class must define hasSaved property')
    }

    return (this as any).hasSaved && this.isDirty(column)
  }

  getOriginal<K extends keyof T>(column?: K): K extends keyof T ? T[K] : Partial<T> {
    if (!('originalAttributes' in this)) {
      throw new Error('Child class must define originalAttributes property')
    }

    if (column) {
      return (this as any).originalAttributes[column as string]
    }

    return (this as any).originalAttributes
  }

  getChanges(): Partial<T> {
    if (!('attributes' in this) || !('originalAttributes' in this) || !('fillable' in this)) {
      throw new Error('Child class must define attributes, originalAttributes, and fillable properties')
    }

    return (this as any).fillable.reduce((changes: Partial<T>, key: string) => {
      const currentValue = (this as any).attributes[key]
      const originalValue = (this as any).originalAttributes[key]

      if (currentValue !== originalValue) {
        changes[key as keyof T] = currentValue
      }

      return changes
    }, {} as Partial<T>)
  }

  applyFill(data: Partial<any>): this {
    if (!('attributes' in this) || !('fillable' in this) || !('guarded' in this)) {
      throw new Error('Child class must define attributes, fillable, and guarded properties')
    }

    // Filter the data based on fillable and guarded properties
    for (const [key, value] of Object.entries(data)) {
      if (!(this as any).guarded.includes(key) && (this as any).fillable.includes(key)) {
        (this as any).attributes[key] = value
      }
    }

    return this
  }

  fill(data: Partial<any>): this {
    return this.applyFill(data)
  }

  applyForceFill(data: Partial<any>): this {
    if (!('attributes' in this)) {
      throw new Error('Child class must define attributes property')
    }

    // Directly merge all data into attributes
    for (const [key, value] of Object.entries(data)) {
      (this as any).attributes[key] = value
    }

    return this
  }

  forceFill(data: Partial<any>): this {
    return this.applyForceFill(data)
  }

  // Methods to be implemented by child classes
  protected mapCustomGetters(_model: T): void {}

  protected async loadRelations(_model: T): Promise<void> {}

  // Base implementations for categorizable trait
  protected async getCategoryIds(id: number): Promise<number[]> {
    const categoryLinks = await DB.instance
      .selectFrom('categorizable_models')
      .where('categorizable_id', '=', id)
      .where('categorizable_type', '=', this.tableName)
      .selectAll()
      .execute()

    return categoryLinks.map((link: { category_id: number }) => link.category_id)
  }

  protected async baseCategories(id: number): Promise<any[]> {
    const categoryIds = await this.getCategoryIds(id)

    if (categoryIds.length === 0)
      return []

    return await DB.instance
      .selectFrom('categorizable')
      .where('id', 'in', categoryIds)
      .selectAll()
      .execute()
  }

  protected async baseCategoryCount(id: number): Promise<number> {
    const categoryIds = await this.getCategoryIds(id)
    return categoryIds.length
  }

  protected async baseAddCategory(id: number, category: { name: string, description?: string }): Promise<any> {
    // First check if category exists or create it
    let categoryRecord = await DB.instance
      .selectFrom('categorizable')
      .where('name', '=', category.name)
      .selectAll()
      .executeTakeFirst()

    if (!categoryRecord) {
      categoryRecord = await DB.instance
        .insertInto('categorizable')
        .values({
          name: category.name,
          description: category.description,
          slug: category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirst()
    }

    // Then create the relationship
    return await DB.instance
      .insertInto('categorizable_models')
      .values({
        categorizable_id: id,
        categorizable_type: this.tableName,
        category_id: categoryRecord.id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirst()
  }

  protected async baseActiveCategories(id: number): Promise<any[]> {
    const categoryIds = await this.getCategoryIds(id)

    if (categoryIds.length === 0)
      return []

    return await DB.instance
      .selectFrom('categorizable')
      .where('id', 'in', categoryIds)
      .where('is_active', '=', true)
      .selectAll()
      .execute()
  }

  protected async baseInactiveCategories(id: number): Promise<any[]> {
    const categoryIds = await this.getCategoryIds(id)

    if (categoryIds.length === 0)
      return []

    return await DB.instance
      .selectFrom('categorizable')
      .where('id', 'in', categoryIds)
      .where('is_active', '=', false)
      .selectAll()
      .execute()
  }

  protected async baseRemoveCategory(categoryId: number): Promise<void> {
    await DB.instance
      .deleteFrom('categorizable')
      .where('categorizable_type', '=', this.tableName)
      .where('id', '=', categoryId)
      .execute()
  }

  // Base implementations for taggable trait
  protected async baseTags(id: number): Promise<any[]> {
    return await DB.instance
      .selectFrom('taggable')
      .where('taggable_id', '=', id)
      .where('taggable_type', '=', this.tableName)
      .selectAll()
      .execute()
  }

  protected async baseTagCount(id: number): Promise<number> {
    const result = await DB.instance
      .selectFrom('taggable')
      .select(sql`count(*) as count`)
      .where('taggable_id', '=', id)
      .where('taggable_type', '=', this.tableName)
      .executeTakeFirst()

    return Number(result?.count) || 0
  }

  protected async baseAddTag(id: number, tag: { name: string, description?: string }): Promise<any> {
    return await DB.instance
      .insertInto('taggable')
      .values({
        ...tag,
        taggable_id: id,
        taggable_type: this.tableName,
        slug: tag.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        order: 0,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirst()
  }

  protected async baseActiveTags(id: number): Promise<any[]> {
    return await DB.instance
      .selectFrom('taggable')
      .where('taggable_id', '=', id)
      .where('taggable_type', '=', this.tableName)
      .where('is_active', '=', true)
      .selectAll()
      .execute()
  }

  protected async baseInactiveTags(id: number): Promise<any[]> {
    return await DB.instance
      .selectFrom('taggable')
      .where('taggable_id', '=', id)
      .where('taggable_type', '=', this.tableName)
      .where('is_active', '=', false)
      .selectAll()
      .execute()
  }

  protected async baseRemoveTag(id: number, tagId: number): Promise<void> {
    await DB.instance
      .deleteFrom('taggable')
      .where('taggable_id', '=', id)
      .where('taggable_type', '=', this.tableName)
      .where('id', '=', tagId)
      .execute()
  }

  // Base implementations for commentable trait
  protected async baseComments(id: number): Promise<any[]> {
    return await DB.instance
      .selectFrom('comments')
      .where('commentables_id', '=', id)
      .where('commentables_type', '=', this.tableName)
      .selectAll()
      .execute()
  }

  protected async baseCommentCount(id: number): Promise<number> {
    const result = await DB.instance
      .selectFrom('comments')
      .select(sql`count(*) as count`)
      .where('commentables_id', '=', id)
      .where('commentables_type', '=', this.tableName)
      .executeTakeFirst()

    return Number(result?.count) || 0
  }

  protected async baseAddComment(id: number, comment: { title: string, body: string }): Promise<any> {
    return await DB.instance
      .insertInto('comments')
      .values({
        ...comment,
        commentables_id: id,
        commentables_type: this.tableName,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirst()
  }

  protected async baseApprovedComments(id: number): Promise<any[]> {
    return await DB.instance
      .selectFrom('comments')
      .where('commentables_id', '=', id)
      .where('commentables_type', '=', this.tableName)
      .where('status', '=', 'approved')
      .selectAll()
      .execute()
  }

  protected async basePendingComments(id: number): Promise<any[]> {
    return await DB.instance
      .selectFrom('comments')
      .where('commentables_id', '=', id)
      .where('commentables_type', '=', this.tableName)
      .where('status', '=', 'pending')
      .selectAll()
      .execute()
  }

  protected async baseRejectedComments(id: number): Promise<any[]> {
    return await DB.instance
      .selectFrom('comments')
      .where('commentables_id', '=', id)
      .where('commentables_type', '=', this.tableName)
      .where('status', '=', 'rejected')
      .selectAll()
      .execute()
  }
}
