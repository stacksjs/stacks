import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { UserModel } from './User'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import User from './User'

export interface PostsTable {
  id: Generated<number>
  user_id: number
  title: string
  body: string

  created_at?: Date

  updated_at?: Date

}

export interface PostResponse {
  data: PostJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PostJsonResponse extends Omit<Selectable<PostsTable>, 'password'> {
  [key: string]: any
}

export type NewPost = Insertable<PostsTable>
export type PostUpdate = Updateable<PostsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: PostJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class PostModel extends BaseOrm<PostModel, PostsTable, PostJsonResponse> {
  private readonly hidden: Array<keyof PostJsonResponse> = []
  private readonly fillable: Array<keyof PostJsonResponse> = ['title', 'body', 'uuid', 'user_id']
  private readonly guarded: Array<keyof PostJsonResponse> = []
  protected attributes = {} as PostJsonResponse
  protected originalAttributes = {} as PostJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(post: PostJsonResponse | undefined) {
    super('posts')
    if (post) {
      this.attributes = { ...post }
      this.originalAttributes = { ...post }

      Object.keys(post).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (post as PostJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('posts')
    this.updateFromQuery = DB.instance.updateTable('posts')
    this.deleteFromQuery = DB.instance.deleteFrom('posts')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: PostJsonResponse | PostJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PostJsonResponse) => {
        const customGetter = {
          default: () => {
          },

        }

        for (const [key, fn] of Object.entries(customGetter)) {
          model[key] = fn()
        }

        return model
      })
    }
    else {
      const model = data

      const customGetter = {
        default: () => {
        },

      }

      for (const [key, fn] of Object.entries(customGetter)) {
        model[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewPost | PostUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get user_id(): number {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get id(): number {
    return this.attributes.id
  }

  get title(): string {
    return this.attributes.title
  }

  get body(): string {
    return this.attributes.body
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set title(value: string) {
    this.attributes.title = value
  }

  set body(value: string) {
    this.attributes.body = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof PostJsonResponse): Partial<PostJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<PostJsonResponse> {
    return this.fillable.reduce<Partial<PostJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof PostsTable]
      const originalValue = this.originalAttributes[key as keyof PostsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof PostJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof PostJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof PostJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof PostJsonResponse)[] | RawBuilder<string> | string): PostModel {
    const instance = new PostModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Post by ID
  static async find(id: number): Promise<PostModel | undefined> {
    const instance = new PostModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<PostModel | undefined> {
    const model = await this.applyFirst()

    const data = new PostModel(model)

    return data
  }

  static async first(): Promise<PostModel | undefined> {
    const instance = new PostModel(undefined)

    const model = await instance.applyFirst()

    const data = new PostModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<PostModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No PostModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new PostModel(model)

    return data
  }

  async firstOrFail(): Promise<PostModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<PostModel | undefined> {
    const instance = new PostModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PostModel[]> {
    const instance = new PostModel(undefined)

    const models = await DB.instance.selectFrom('posts').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PostJsonResponse) => {
      return new PostModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<PostModel> {
    const model = await DB.instance.selectFrom('posts').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No PostModel results for ${id}`)

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new PostModel(model)

    return data
  }

  async findOrFail(id: number): Promise<PostModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<PostModel> {
    const instance = new PostModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PostModel[]> {
    const instance = new PostModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new PostModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<PostModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new PostModel(modelItem)))
  }

  skip(count: number): PostModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): PostModel {
    const instance = new PostModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: PostModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: PostModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: PostModel[]) => Promise<void>): Promise<void> {
    const instance = new PostModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof PostModel>(field: K): Promise<PostModel[K][]> {
    const instance = new PostModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: PostModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PostModel) => modelItem[field])
  }

  async pluck<K extends keyof PostModel>(field: K): Promise<PostModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: PostModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PostModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new PostModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  async count(): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  static async max(field: keyof PostModel): Promise<number> {
    const instance = new PostModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof PostModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof PostModel): Promise<number> {
    const instance = new PostModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof PostModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof PostModel): Promise<number> {
    const instance = new PostModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof PostModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof PostModel): Promise<number> {
    const instance = new PostModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof PostModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<PostModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: PostJsonResponse) => {
      return new PostModel(model)
    }))

    return data
  }

  async get(): Promise<PostModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<PostModel[]> {
    const instance = new PostModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): PostModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.post_id`, '=', 'posts.id'),
      ),
    )

    return this
  }

  static has(relation: string): PostModel {
    const instance = new PostModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.post_id`, '=', 'posts.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): PostModel {
    const instance = new PostModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof PostModel>) => void,
  ): PostModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.post_id`, '=', 'posts.id')

        conditions.forEach((condition) => {
          switch (condition.method) {
            case 'where':
              if (condition.type === 'and') {
                subquery = subquery.where(condition.column, condition.operator!, condition.value)
              }
              else {
                subquery = subquery.orWhere(condition.column, condition.operator!, condition.value)
              }
              break

            case 'whereIn':
              if (condition.operator === 'is not') {
                subquery = subquery.whereNotIn(condition.column, condition.values)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return exists(subquery)
      })

    return this
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof PostModel>) => void,
  ): PostModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof PostModel>) => void,
  ): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): PostModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.post_id`, '=', 'posts.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): PostModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PostsTable>) => void): PostModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.post_id`, '=', 'posts.id')

        return not(exists(subquery))
      })

    conditions.forEach((condition) => {
      switch (condition.method) {
        case 'where':
          if (condition.type === 'and') {
            this.where(condition.column, condition.operator!, condition.value || [])
          }
          break

        case 'whereIn':
          if (condition.operator === 'is not') {
            this.whereNotIn(condition.column, condition.values || [])
          }
          else {
            this.whereIn(condition.column, condition.values || [])
          }

          break

        case 'whereNull':
          this.whereNull(condition.column)
          break

        case 'whereNotNull':
          this.whereNotNull(condition.column)
          break

        case 'whereBetween':
          this.whereBetween(condition.column, condition.range || [0, 0])
          break

        case 'whereExists': {
          const nestedBuilder = new SubqueryBuilder()
          condition.callback!(nestedBuilder)
          break
        }
      }
    })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PostsTable>) => void): PostModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<PostsTable>) => void,
  ): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PostResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('posts')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const postsWithExtra = await DB.instance.selectFrom('posts')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (postsWithExtra.length > (options.limit ?? 10))
      nextCursor = postsWithExtra.pop()?.id ?? null

    return {
      data: postsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PostResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all posts
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PostResponse> {
    const instance = new PostModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newPost: NewPost): Promise<PostModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPost).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPost

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('posts')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as PostModel

    return model
  }

  async create(newPost: NewPost): Promise<PostModel> {
    return await this.applyCreate(newPost)
  }

  static async create(newPost: NewPost): Promise<PostModel> {
    const instance = new PostModel(undefined)

    return await instance.applyCreate(newPost)
  }

  static async createMany(newPost: NewPost[]): Promise<void> {
    const instance = new PostModel(undefined)

    const valuesFiltered = newPost.map((newPost: NewPost) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPost).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPost

      return filteredValues
    })

    await DB.instance.insertInto('posts')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPost: NewPost): Promise<PostModel> {
    const result = await DB.instance.insertInto('posts')
      .values(newPost)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PostModel

    return model
  }

  // Method to remove a Post
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('posts')
      .where('id', '=', id)
      .execute()
  }

  static where<V = string>(column: keyof PostsTable, ...args: [V] | [Operator, V]): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereColumn(first: keyof PostsTable, operator: Operator, second: keyof PostsTable): PostModel {
    const instance = new PostModel(undefined)

    instance.selectFromQuery = instance.applyWhereColumn(first, operator, second)

    return instance
  }

  static whereRef(column: keyof PostsTable, ...args: string[]): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static whereRaw(sqlStatement: string): PostModel {
    const instance = new PostModel(undefined)

    instance.selectFromQuery = instance.applyWhereRaw(sqlStatement)

    return instance
  }

  static orWhere(...conditions: [string, any][]): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static when(condition: boolean, callback: (query: PostModel) => PostModel): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhen(condition, callback)
  }

  static whereNotNull(column: keyof PostsTable): PostModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereNull(column: keyof PostsTable): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereTitle(value: string): PostModel {
    const instance = new PostModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('title', '=', value)

    return instance
  }

  static whereBody(value: string): PostModel {
    const instance = new PostModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('body', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PostsTable, values: V[]): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof PostsTable, range: [V, V]): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereLike(column: keyof PostsTable, value: string): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static whereNotIn<V = number>(column: keyof PostsTable, values: V[]): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
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

  static async latest(): Promise<PostModel | undefined> {
    const instance = new PostModel(undefined)

    const model = await DB.instance.selectFrom('posts')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new PostModel(model)

    return data
  }

  static async oldest(): Promise<PostModel | undefined> {
    const instance = new PostModel(undefined)

    const model = await DB.instance.selectFrom('posts')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new PostModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<PostJsonResponse>,
    newPost: NewPost,
  ): Promise<PostModel> {
    const instance = new PostModel(undefined)

    const key = Object.keys(condition)[0] as keyof PostJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingPost = await DB.instance.selectFrom('posts')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingPost) {
      instance.mapCustomGetters(existingPost)
      await instance.loadRelations(existingPost)

      return new PostModel(existingPost as PostJsonResponse)
    }
    else {
      return await instance.create(newPost)
    }
  }

  static async updateOrCreate(
    condition: Partial<PostJsonResponse>,
    newPost: NewPost,
  ): Promise<PostModel> {
    const instance = new PostModel(undefined)

    const key = Object.keys(condition)[0] as keyof PostJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingPost = await DB.instance.selectFrom('posts')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingPost) {
      // If found, update the existing record
      await DB.instance.updateTable('posts')
        .set(newPost)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedPost = await DB.instance.selectFrom('posts')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedPost) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new PostModel(updatedPost as PostJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newPost)
    }
  }

  protected async loadRelations(models: PostJsonResponse | PostJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('post_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PostJsonResponse) => {
          const records = relatedRecords.filter((record: { post_id: number }) => {
            return record.post_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { post_id: number }) => {
          return record.post_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): PostModel {
    const instance = new PostModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<PostModel | undefined> {
    const model = await this.applyLast()

    const data = new PostModel(model)

    return data
  }

  static async last(): Promise<PostModel | undefined> {
    const instance = new PostModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    const data = new PostModel(model)

    return data
  }

  static orderBy(column: keyof PostsTable, order: 'asc' | 'desc'): PostModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static groupBy(column: keyof PostsTable): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof PostsTable, operator: Operator, value: V): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyHaving(column, operator, value)
  }

  static inRandomOrder(): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyInRandomOrder()
  }

  static orderByDesc(column: keyof PostsTable): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static orderByAsc(column: keyof PostsTable): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  async update(newPost: PostUpdate): Promise<PostModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPost).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPost

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('posts')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(post: PostUpdate): Promise<PostModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(post).execute()
    }

    await this.mapCustomSetters(post)

    await DB.instance.updateTable('posts')
      .set(post)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Post data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<PostJsonResponse>): PostModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPost

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<PostJsonResponse>): PostModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the post instance
  async delete(): Promise<PostsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('posts')
      .where('id', '=', this.id)
      .execute()
  }

  async userBelong(): Promise<UserModel> {
    if (this.user_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await User
      .where('id', '=', this.user_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  distinct(column: keyof PostJsonResponse): PostModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof PostJsonResponse): PostModel {
    const instance = new PostModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): PostModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): PostModel {
    const instance = new PostModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): PostJsonResponse {
    const output = {

      id: this.id,
      title: this.title,
      body: this.body,

      created_at: this.created_at,

      updated_at: this.updated_at,

      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: PostModel): PostModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PostModel]
    }

    return model
  }
}

async function find(id: number): Promise<PostModel | undefined> {
  const query = DB.instance.selectFrom('posts').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new PostModel(model)
}

export async function count(): Promise<number> {
  const results = await PostModel.count()

  return results
}

export async function create(newPost: NewPost): Promise<PostModel> {
  const result = await DB.instance.insertInto('posts')
    .values(newPost)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as PostModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('posts')
    .where('id', '=', id)
    .execute()
}

export async function whereTitle(value: string): Promise<PostModel[]> {
  const query = DB.instance.selectFrom('posts').where('title', '=', value)
  const results: PostJsonResponse = await query.execute()

  return results.map((modelItem: PostJsonResponse) => new PostModel(modelItem))
}

export async function whereBody(value: string): Promise<PostModel[]> {
  const query = DB.instance.selectFrom('posts').where('body', '=', value)
  const results: PostJsonResponse = await query.execute()

  return results.map((modelItem: PostJsonResponse) => new PostModel(modelItem))
}

export const Post = PostModel

export default Post
