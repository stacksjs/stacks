import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { UserModel } from './User'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import User from './User'

export interface PostsTable {
  id?: number
  user_id?: number
  user?: UserModel
  title?: string
  body?: string

  created_at?: Date

  updated_at?: Date

}

interface PostResponse {
  data: PostJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PostJsonResponse extends Omit<PostsTable, 'password'> {
  [key: string]: any
}

export type PostType = Selectable<PostsTable>
export type NewPost = Partial<Insertable<PostsTable>>
export type PostUpdate = Updateable<PostsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: PostType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class PostModel {
  private readonly hidden: Array<keyof PostJsonResponse> = []
  private readonly fillable: Array<keyof PostJsonResponse> = ['title', 'body', 'uuid', 'user_id']

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}
  public user_id: number | undefined
  public user: UserModel | undefined
  public id: number | undefined
  public title: string | undefined
  public body: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(post: Partial<PostType> | null) {
    if (post) {
      this.user_id = post?.user_id
      this.user = post?.user
      this.id = post?.id || 1
      this.title = post?.title
      this.body = post?.body

      this.created_at = post?.created_at

      this.updated_at = post?.updated_at

      Object.keys(post).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (post as PostJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('posts')
    this.updateFromQuery = db.updateTable('posts')
    this.deleteFromQuery = db.deleteFrom('posts')
    this.hasSelect = false
  }

  static select(params: (keyof PostType)[] | RawBuilder<string>): PostModel {
    const instance = new PostModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a Post by ID
  async find(id: number): Promise<PostModel | undefined> {
    const query = db.selectFrom('posts').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new PostModel(result as PostType)

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    return data
  }

  // Method to find a Post by ID
  static async find(id: number): Promise<PostModel | undefined> {
    const model = await db.selectFrom('posts').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PostModel(null)

    const result = await instance.mapWith(model)

    const data = new PostModel(result as PostType)

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    return data
  }

  async mapWith(model: PostType): Promise<PostType> {
    if (this.withRelations.includes('user')) {
      model.user = await this.userBelong()
    }

    return model
  }

  static async all(): Promise<PostModel[]> {
    const models = await db.selectFrom('posts').selectAll().execute()

    const data = await Promise.all(models.map(async (model: PostType) => {
      const instance = new PostModel(model)

      const results = await instance.mapWith(model)

      return new PostModel(results)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<PostModel> {
    const model = await db.selectFrom('posts').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new PostModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No PostModel results for ${id}`)

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  async findOrFail(id: number): Promise<PostModel> {
    const model = await db.selectFrom('posts').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No PostModel results for ${id}`)

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    const result = await this.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  static async findMany(ids: number[]): Promise<PostModel[]> {
    let query = db.selectFrom('posts').where('id', 'in', ids)

    const instance = new PostModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new PostModel(modelItem)))
  }

  async pluck<K extends keyof PostModel>(field: K): Promise<PostModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: PostModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()
    return model.map((modelItem: PostModel) => modelItem[field])
  }

  static async get(): Promise<PostModel[]> {
    const instance = new PostModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: PostModel) => {
      const instance = new PostModel(model)

      const results = await instance.mapWith(model)

      return new PostModel(results)
    }))

    return data
  }

  // Method to get a Post by criteria
  async get(): Promise<PostModel[]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: PostModel) => new PostModel(modelItem))
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PostModel) => new PostModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new PostModel(null)

    const results = await instance.selectFromQuery.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      const results = await this.selectFromQuery.execute()

      return results.length
    }

    const results = await this.selectFromQuery.execute()

    return results.length
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PostResponse> {
    const totalRecordsResult = await db.selectFrom('posts')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    if (this.hasSelect) {
      const postsWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
        .limit((options.limit ?? 10) + 1)
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

    const postsWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
      .limit((options.limit ?? 10) + 1)
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

  // Method to get all posts
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PostResponse> {
    const totalRecordsResult = await db.selectFrom('posts')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const postsWithExtra = await db.selectFrom('posts')
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

  // Method to create a new post
  static async create(newPost: NewPost): Promise<PostModel> {
    const instance = new PostModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newPost).filter(([key]) => instance.fillable.includes(key)),
    ) as NewPost

    const result = await db.insertInto('posts')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PostModel

    return model
  }

  static async createMany(newPosts: NewPost[]): Promise<void> {
    const instance = new PostModel(null)

    const filteredValues = newPosts.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewPost,
    )

    await db.insertInto('posts')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newPost: NewPost): Promise<PostModel> {
    const result = await db.insertInto('posts')
      .values(newPost)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PostModel

    return model
  }

  // Method to remove a Post
  static async remove(id: number): Promise<any> {
    return await db.deleteFrom('posts')
      .where('id', '=', id)
      .execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): PostModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    this.selectFromQuery = this.selectFromQuery.where(column, operator, value)

    this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
    this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)

    return this
  }

  orWhere(...args: Array<[string, string, any]>): PostModel {
    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return this
  }

  static orWhere(...args: Array<[string, string, any]>): PostModel {
    const instance = new PostModel(null)

    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return instance
  }

  static where(...args: (string | number | boolean | undefined | null)[]): PostModel {
    let column: any
    let operator: any
    let value: any

    const instance = new PostModel(null)

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)

    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  static when(
    condition: boolean,
    callback: (query: PostModel) => PostModel,
  ): PostModel {
    let instance = new PostModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  when(
    condition: boolean,
    callback: (query: PostModel) => PostModel,
  ): PostModel {
    if (condition)
      callback(this.selectFromQuery)

    return this
  }

  static whereNull(column: string): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  whereNull(column: string): PostModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereTitle(value: string): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('title', '=', value)

    return instance
  }

  static whereBody(value: string): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('body', '=', value)

    return instance
  }

  whereIn(column: keyof PostType, values: any[]): PostModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  static whereIn(column: keyof PostType, values: any[]): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  static whereBetween(column: keyof PostType, range: [any, any]): PostModel {
    if (range.length !== 2) {
      throw new Error('Range must have exactly two values: [min, max]')
    }

    const instance = new PostModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  static whereNotIn(column: keyof PostType, values: any[]): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  whereNotIn(column: keyof PostType, values: any[]): PostModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  async first(): Promise<PostModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  async firstOrFail(): Promise<PostModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No PostModel results found for query')

    const instance = new PostModel(null)

    const result = await instance.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<PostType | undefined> {
    const model = await db.selectFrom('posts')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PostModel(null)

    const result = await instance.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  static async latest(): Promise<PostType | undefined> {
    const model = await db.selectFrom('posts')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PostModel(null)
    const result = await instance.mapWith(model)
    const data = new PostModel(result as PostType)

    return data
  }

  static async oldest(): Promise<PostType | undefined> {
    const model = await db.selectFrom('posts')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PostModel(null)
    const result = await instance.mapWith(model)
    const data = new PostModel(result as PostType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<PostType>,
    newPost: NewPost,
  ): Promise<PostModel> {
    // Get the key and value from the condition object
    const key = Object.keys(condition)[0] as keyof PostType

    if (!key) {
      throw new Error('Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingPost = await db.selectFrom('posts')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingPost) {
      const instance = new PostModel(null)
      const result = await instance.mapWith(existingPost)
      return new PostModel(result as PostType)
    }
    else {
      // If not found, create a new user
      return await this.create(newPost)
    }
  }

  static async updateOrCreate(
    condition: Partial<PostType>,
    newPost: NewPost,
  ): Promise<PostModel> {
    const key = Object.keys(condition)[0] as keyof PostType

    if (!key) {
      throw new Error('Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingPost = await db.selectFrom('posts')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingPost) {
      // If found, update the existing record
      await db.updateTable('posts')
        .set(newPost)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedPost = await db.selectFrom('posts')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedPost) {
        throw new Error('Failed to fetch updated record')
      }

      const instance = new PostModel(null)
      const result = await instance.mapWith(updatedPost)
      return new PostModel(result as PostType)
    }
    else {
      // If not found, create a new record
      return await this.create(newPost)
    }
  }

  with(relations: string[]): PostModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): PostModel {
    const instance = new PostModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<PostType | undefined> {
    return await db.selectFrom('posts')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<PostType | undefined> {
    const model = await db.selectFrom('posts').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PostModel(null)

    const result = await instance.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  static orderBy(column: keyof PostType, order: 'asc' | 'desc'): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  static groupBy(column: keyof PostType): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  static having(column: keyof PostType, operator: string, value: any): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  orderBy(column: keyof PostType, order: 'asc' | 'desc'): PostModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  having(column: keyof PostType, operator: string, value: any): PostModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  groupBy(column: keyof PostType): PostModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static orderByDesc(column: keyof PostType): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof PostType): PostModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof PostType): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof PostType): PostModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(post: PostUpdate): Promise<PostModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(post).filter(([key]) => this.fillable.includes(key)),
    ) as NewPost

    await db.updateTable('posts')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  async forceUpdate(post: PostUpdate): Promise<PostModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(post).execute()
    }

    await db.updateTable('posts')
      .set(post)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Post data is undefined')

    if (this.id === undefined) {
      await db.insertInto('posts')
        .values(this as NewPost)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the post instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await db.deleteFrom('posts')
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

  distinct(column: keyof PostType): PostModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof PostType): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): PostModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON(): Partial<PostJsonResponse> {
    const output: Partial<PostJsonResponse> = {

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
  const query = db.selectFrom('posts').where('id', '=', id).selectAll()

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
  const result = await db.insertInto('posts')
    .values(newPost)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as PostModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('posts')
    .where('id', '=', id)
    .execute()
}

export async function whereTitle(value: string): Promise<PostModel[]> {
  const query = db.selectFrom('posts').where('title', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PostModel(modelItem))
}

export async function whereBody(value: string): Promise<PostModel[]> {
  const query = db.selectFrom('posts').where('body', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PostModel(modelItem))
}

export const Post = PostModel

export default Post
