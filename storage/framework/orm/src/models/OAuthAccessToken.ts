import type { Generated, Insertable, RawBuilder, Selectable, Updateable, Sql} from '@stacksjs/database'
import { manageCharge, manageCheckout, manageCustomer, manageInvoice, managePaymentMethod, manageSubscription, manageTransaction, managePrice, manageSetupIntent } from '@stacksjs/payments'
import Stripe from 'stripe'
import { db, sql } from '@stacksjs/database'
import { BaseOrm } from '../utils/base'
import type { Operator } from '@stacksjs/orm'
import type { CheckoutLineItem, CheckoutOptions, StripeCustomerOptions } from '@stacksjs/types'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { generateTwoFactorSecret } from '@stacksjs/auth'
import { verifyTwoFactorCode } from '@stacksjs/auth'
import { randomUUIDv7 } from 'bun'
import type { OAuthAccessTokenModelType, OAuthAccessTokenJsonResponse, NewOAuthAccessToken, OAuthAccessTokenUpdate, OauthAccessTokensTable } from '../types/OAuthAccessTokenType'

import type {UserModel} from './User'

import type {OAuthClientModel} from './OAuthClient'




import type { Model } from '@stacksjs/types';
import { schema } from '@stacksjs/validation';




export class OAuthAccessTokenModel extends BaseOrm<OAuthAccessTokenModel, OauthAccessTokensTable, OAuthAccessTokenJsonResponse> {
  private readonly hidden: Array<keyof OAuthAccessTokenJsonResponse> = []
  private readonly fillable: Array<keyof OAuthAccessTokenJsonResponse> = ["token","name","scopes","revoked","expires_at"]
  private readonly guarded: Array<keyof OAuthAccessTokenJsonResponse> = []
  protected attributes = {} as OAuthAccessTokenJsonResponse
  protected originalAttributes = {} as OAuthAccessTokenJsonResponse
  
  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

  constructor(oAuthAccessToken: OAuthAccessTokenJsonResponse | undefined) {
    super('oauth_access_tokens')
    if (oAuthAccessToken) {

      this.attributes = { ...oAuthAccessToken }
      this.originalAttributes = { ...oAuthAccessToken }

      Object.keys(oAuthAccessToken).forEach(key => {
        if (!(key in this)) {
           this.customColumns[key] = (oAuthAccessToken as OAuthAccessTokenJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('oauth_access_tokens')
    this.updateFromQuery = db.updateTable('oauth_access_tokens')
    this.deleteFromQuery = db.deleteFrom('oauth_access_tokens')
    this.hasSelect = false
  }

  protected async loadRelations(models: OAuthAccessTokenJsonResponse | OAuthAccessTokenJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length) return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await db
        .selectFrom(relation)
        .where('oAuthAccessToken_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: OAuthAccessTokenJsonResponse) => {
          const records = relatedRecords.filter((record: { oAuthAccessToken_id: number }) => {
            return record.oAuthAccessToken_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      } else {
        const records = relatedRecords.filter((record: { oAuthAccessToken_id: number }) => {
          return record.oAuthAccessToken_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: OAuthAccessTokenJsonResponse | OAuthAccessTokenJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: OAuthAccessTokenJsonResponse) => {

        const customGetter = {
          default: () => {
          },

          
        }

        for (const [key, fn] of Object.entries(customGetter)) {
          (model as any)[key] = fn()
        }

        return model
      })
    } else {
      const model = data

      const customGetter = {
        default: () => {
        },

        
      }

      for (const [key, fn] of Object.entries(customGetter)) {
        (model as any)[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewOAuthAccessToken): Promise<void> {
    const customSetter = {
      default: () => {
      },

      
    }

    for (const [key, fn] of Object.entries(customSetter)) {
        (model as any)[key] = await fn()
    }
  }

  get user_id(): number {
        return this.attributes.user_id
      }

get user(): UserModel | undefined {
        return this.attributes.user
      }

get o_auth_client_id(): number {
        return this.attributes.o_auth_client_id
      }

get o_auth_client(): OAuthClientModel | undefined {
        return this.attributes.o_auth_client
      }

get id(): number {
    return this.attributes.id
  }

get token(): string {
      return this.attributes.token
    }

get name(): string | undefined {
      return this.attributes.name
    }

get scopes(): string | undefined {
      return this.attributes.scopes
    }

get revoked(): boolean {
      return this.attributes.revoked
    }

get expires_at(): Date | string | undefined {
      return this.attributes.expires_at
    }

get created_at(): string | undefined {
      return this.attributes.created_at
    }

    get updated_at(): string | undefined {
      return this.attributes.updated_at
    }


  set token(value: string) {
      this.attributes.token = value
    }

set name(value: string) {
      this.attributes.name = value
    }

set scopes(value: string) {
      this.attributes.scopes = value
    }

set revoked(value: boolean) {
      this.attributes.revoked = value
    }

set expires_at(value: Date | string) {
      this.attributes.expires_at = value
    }

set updated_at(value: string) {
      this.attributes.updated_at = value
    }



  static select(params: (keyof OAuthAccessTokenJsonResponse)[] | RawBuilder<string> | string): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a OAuthAccessToken by ID
  static async find(id: number): Promise<OAuthAccessTokenModel | undefined> {
    let query = db.selectFrom('oauth_access_tokens').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return undefined

    const instance = new OAuthAccessTokenModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<OAuthAccessTokenModel | undefined> {
    const instance = new OAuthAccessTokenModel(undefined)

    const model = await instance.applyFirst()

    const data = new OAuthAccessTokenModel(model)

    return data
  }

  static async last(): Promise<OAuthAccessTokenModel | undefined> {
    const instance = new OAuthAccessTokenModel(undefined)

    const model = await instance.applyLast()

    if (!model) return undefined

    return new OAuthAccessTokenModel(model)
  }

  static async firstOrFail(): Promise<OAuthAccessTokenModel | undefined> {
    const instance = new OAuthAccessTokenModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<OAuthAccessTokenModel[]> {
    const instance = new OAuthAccessTokenModel(undefined)

    const models = await db.selectFrom('oauth_access_tokens').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: OAuthAccessTokenJsonResponse) => {
      return new OAuthAccessTokenModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<OAuthAccessTokenModel | undefined> {
    const instance = new OAuthAccessTokenModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<OAuthAccessTokenModel[]> {
    const instance = new OAuthAccessTokenModel(undefined)
     
    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: OAuthAccessTokenJsonResponse) => instance.parseResult(new OAuthAccessTokenModel(modelItem)))
  }

  static async latest(column: keyof OauthAccessTokensTable = 'created_at'): Promise<OAuthAccessTokenModel | undefined> {
    const instance = new OAuthAccessTokenModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model) return undefined

    return new OAuthAccessTokenModel(model)
  }

  static async oldest(column: keyof OauthAccessTokensTable = 'created_at'): Promise<OAuthAccessTokenModel | undefined> {
    const instance = new OAuthAccessTokenModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model) return undefined

    return new OAuthAccessTokenModel(model)
  }

  static skip(count: number): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof OauthAccessTokensTable, ...args: [V] | [Operator, V]): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof OauthAccessTokensTable, values: V[]): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof OauthAccessTokensTable, range: [V, V]): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof OauthAccessTokensTable, ...args: string[]): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: OAuthAccessTokenModel) => OAuthAccessTokenModel): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof OauthAccessTokensTable): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof OauthAccessTokensTable): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof OauthAccessTokensTable, value: string): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof OauthAccessTokensTable, order: 'asc' | 'desc'): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof OauthAccessTokensTable): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof OauthAccessTokensTable): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof OauthAccessTokensTable): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof OauthAccessTokensTable, operator: Operator, value: V): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof OauthAccessTokensTable, operator: Operator, second: keyof OauthAccessTokensTable): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof OauthAccessTokensTable): Promise<number> {
    const instance = new OAuthAccessTokenModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof OauthAccessTokensTable): Promise<number> {
    const instance = new OAuthAccessTokenModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof OauthAccessTokensTable): Promise<number> {
    const instance = new OAuthAccessTokenModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof OauthAccessTokensTable): Promise<number> {
    const instance = new OAuthAccessTokenModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<OAuthAccessTokenModel[]> {
    const instance = new OAuthAccessTokenModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: OAuthAccessTokenJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof OAuthAccessTokenModel>(field: K): Promise<OAuthAccessTokenModel[K][]> {
    const instance = new OAuthAccessTokenModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: OAuthAccessTokenModel[]) => Promise<void>): Promise<void> {
    const instance = new OAuthAccessTokenModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: OAuthAccessTokenJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: OAuthAccessTokenModel[],
    paging: {
      total_records: number,
      page: number,
      total_pages: number
    },
    next_cursor: number | null
  }> {
    const instance = new OAuthAccessTokenModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: OAuthAccessTokenJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor
    }
  }

  // Instance method for creating model instances
  createInstance(data: OAuthAccessTokenJsonResponse): OAuthAccessTokenModel {
    return new OAuthAccessTokenModel(data)
  }

  async applyCreate(newOAuthAccessToken: NewOAuthAccessToken): Promise<OAuthAccessTokenModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOAuthAccessToken).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key)
      ),
    ) as NewOAuthAccessToken

    await this.mapCustomSetters(filteredValues)

    

    const result = await db.insertInto('oauth_access_tokens')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created OAuthAccessToken')
    }

    
    return this.createInstance(model)
  }

  async create(newOAuthAccessToken: NewOAuthAccessToken): Promise<OAuthAccessTokenModel> {
    return await this.applyCreate(newOAuthAccessToken)
  }

  static async create(newOAuthAccessToken: NewOAuthAccessToken): Promise<OAuthAccessTokenModel> {
    const instance = new OAuthAccessTokenModel(undefined)
    return await instance.applyCreate(newOAuthAccessToken)
  }

  static async firstOrCreate(search: Partial<OauthAccessTokensTable>, values: NewOAuthAccessToken = {} as NewOAuthAccessToken): Promise<OAuthAccessTokenModel> {
    // First try to find a record matching the search criteria
    const instance = new OAuthAccessTokenModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return instance.createInstance(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewOAuthAccessToken
    return await OAuthAccessTokenModel.create(createData)
  }

  static async updateOrCreate(search: Partial<OauthAccessTokensTable>, values: NewOAuthAccessToken = {} as NewOAuthAccessToken): Promise<OAuthAccessTokenModel> {
    // First try to find a record matching the search criteria
    const instance = new OAuthAccessTokenModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as OAuthAccessTokenUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewOAuthAccessToken
    return await OAuthAccessTokenModel.create(createData)
  }

  async update(newOAuthAccessToken: OAuthAccessTokenUpdate): Promise<OAuthAccessTokenModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOAuthAccessToken).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key)
      ),
    ) as OAuthAccessTokenUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await db.updateTable('oauth_access_tokens')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await db.selectFrom('oauth_access_tokens')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OAuthAccessToken')
      }

      
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newOAuthAccessToken: OAuthAccessTokenUpdate): Promise<OAuthAccessTokenModel | undefined> {
    await db.updateTable('oauth_access_tokens')
      .set(newOAuthAccessToken)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await db.selectFrom('oauth_access_tokens')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OAuthAccessToken')
      }

      
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<OAuthAccessTokenModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await db.updateTable('oauth_access_tokens')
        .set(this.attributes as OAuthAccessTokenUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await db.selectFrom('oauth_access_tokens')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OAuthAccessToken')
      }

      
      return this.createInstance(model)
    } else {
      // Create new record
      const result = await db.insertInto('oauth_access_tokens')
        .values(this.attributes as NewOAuthAccessToken)
        .executeTakeFirst()

      // Get the created data
      const model = await db.selectFrom('oauth_access_tokens')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created OAuthAccessToken')
      }

      
      return this.createInstance(model)
    }
  }

  static async createMany(newOAuthAccessToken: NewOAuthAccessToken[]): Promise<void> {
    const instance = new OAuthAccessTokenModel(undefined)

    const valuesFiltered = newOAuthAccessToken.map((newOAuthAccessToken: NewOAuthAccessToken) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newOAuthAccessToken).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewOAuthAccessToken

      

      return filteredValues
    })

    await db.insertInto('oauth_access_tokens')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newOAuthAccessToken: NewOAuthAccessToken): Promise<OAuthAccessTokenModel> {
    const result = await db.insertInto('oauth_access_tokens')
      .values(newOAuthAccessToken)
      .executeTakeFirst()

    const instance = new OAuthAccessTokenModel(undefined)
    const model = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created OAuthAccessToken')
    }

    

    return instance.createInstance(model)
  }

  // Method to remove a OAuthAccessToken
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    
    
    

    const deleted = await db.deleteFrom('oauth_access_tokens')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    

    

    

    

    return await db.deleteFrom('oauth_access_tokens')
      .where('id', '=', id)
      .execute()
  }

  static whereToken(value: string): OAuthAccessTokenModel {
          const instance = new OAuthAccessTokenModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('token', '=', value)

          return instance
        } 

static whereName(value: string): OAuthAccessTokenModel {
          const instance = new OAuthAccessTokenModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

          return instance
        } 

static whereScopes(value: string): OAuthAccessTokenModel {
          const instance = new OAuthAccessTokenModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('scopes', '=', value)

          return instance
        } 

static whereRevoked(value: string): OAuthAccessTokenModel {
          const instance = new OAuthAccessTokenModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('revoked', '=', value)

          return instance
        } 

static whereExpiresAt(value: string): OAuthAccessTokenModel {
          const instance = new OAuthAccessTokenModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('expires_at', '=', value)

          return instance
        } 



  static whereIn<V = number>(column: keyof OauthAccessTokensTable, values: V[]): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  
        async userBelong(): Promise<UserModel> {
          if (this.user_id === undefined)
            throw new HttpError(500, 'Relation Error!')

          const model = await User
            .where('id', '=', this.user_id)
            .first()

          if (! model)
            throw new HttpError(500, 'Model Relation Not Found!')

          return model
        }


        async oAuthClientBelong(): Promise<OAuthClientModel> {
          if (this.o_auth_client_id === undefined)
            throw new HttpError(500, 'Relation Error!')

          const model = await OAuthClient
            .where('id', '=', this.o_auth_client_id)
            .first()

          if (! model)
            throw new HttpError(500, 'Model Relation Not Found!')

          return model
        }



  

  

  

  static distinct(column: keyof OAuthAccessTokenJsonResponse): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): OAuthAccessTokenModel {
    const instance = new OAuthAccessTokenModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): OAuthAccessTokenJsonResponse {
    const output = {

id: this.id,
token: this.token,
   name: this.name,
   scopes: this.scopes,
   revoked: this.revoked,
   expires_at: this.expires_at,
   
        created_at: this.created_at,

        updated_at: this.updated_at,

      user_id: this.user_id,
   user: this.user,
o_auth_client_id: this.o_auth_client_id,
   o_auth_client: this.o_auth_client,
...this.customColumns,
}

    return output
  }

  parseResult(model: OAuthAccessTokenModel): OAuthAccessTokenModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof OAuthAccessTokenModel]
    }

    return model
  }

  

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<OAuthAccessTokenModel | undefined> {
    const model = await db.selectFrom(this.tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)

    await this.loadRelations(model)

    // Return a proper instance using the factory method
    return this.createInstance(model)
  }

  
}

export async function find(id: number): Promise<OAuthAccessTokenModel | undefined> {
  let query = db.selectFrom('oauth_access_tokens').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model) return undefined

  const instance = new OAuthAccessTokenModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await OAuthAccessTokenModel.count()

  return results
}

export async function create(newOAuthAccessToken: NewOAuthAccessToken): Promise<OAuthAccessTokenModel> {
  const instance = new OAuthAccessTokenModel(undefined)
  return await instance.applyCreate(newOAuthAccessToken)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('oauth_access_tokens')
    .where('id', '=', id)
    .execute()
}

export async function whereToken(value: string): Promise<OAuthAccessTokenModel[]> {
          const query = db.selectFrom('oauth_access_tokens').where('token', '=', value)
          const results: OAuthAccessTokenJsonResponse = await query.execute()

          return results.map((modelItem: OAuthAccessTokenJsonResponse) => new OAuthAccessTokenModel(modelItem))
        } 

export async function whereName(value: string): Promise<OAuthAccessTokenModel[]> {
          const query = db.selectFrom('oauth_access_tokens').where('name', '=', value)
          const results: OAuthAccessTokenJsonResponse = await query.execute()

          return results.map((modelItem: OAuthAccessTokenJsonResponse) => new OAuthAccessTokenModel(modelItem))
        } 

export async function whereScopes(value: string): Promise<OAuthAccessTokenModel[]> {
          const query = db.selectFrom('oauth_access_tokens').where('scopes', '=', value)
          const results: OAuthAccessTokenJsonResponse = await query.execute()

          return results.map((modelItem: OAuthAccessTokenJsonResponse) => new OAuthAccessTokenModel(modelItem))
        } 

export async function whereRevoked(value: boolean): Promise<OAuthAccessTokenModel[]> {
          const query = db.selectFrom('oauth_access_tokens').where('revoked', '=', value)
          const results: OAuthAccessTokenJsonResponse = await query.execute()

          return results.map((modelItem: OAuthAccessTokenJsonResponse) => new OAuthAccessTokenModel(modelItem))
        } 

export async function whereExpiresAt(value: Date | string): Promise<OAuthAccessTokenModel[]> {
          const query = db.selectFrom('oauth_access_tokens').where('expires_at', '=', value)
          const results: OAuthAccessTokenJsonResponse = await query.execute()

          return results.map((modelItem: OAuthAccessTokenJsonResponse) => new OAuthAccessTokenModel(modelItem))
        } 



export const OAuthAccessToken = OAuthAccessTokenModel

export default OAuthAccessToken
