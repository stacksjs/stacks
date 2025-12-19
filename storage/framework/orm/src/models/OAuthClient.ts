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
import type { OAuthClientModelType, OAuthClientJsonResponse, NewOAuthClient, OAuthClientUpdate, OauthClientsTable } from '../types/OAuthClientType'




import type { Model } from '@stacksjs/types';
import { schema } from '@stacksjs/validation';




export class OAuthClientModel extends BaseOrm<OAuthClientModel, OauthClientsTable, OAuthClientJsonResponse> {
  private readonly hidden: Array<keyof OAuthClientJsonResponse> = []
  private readonly fillable: Array<keyof OAuthClientJsonResponse> = ["name","secret","provider","redirect","personal_access_client","password_client","revoked"]
  private readonly guarded: Array<keyof OAuthClientJsonResponse> = []
  protected attributes = {} as OAuthClientJsonResponse
  protected originalAttributes = {} as OAuthClientJsonResponse
  
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

  constructor(oAuthClient: OAuthClientJsonResponse | undefined) {
    super('oauth_clients')
    if (oAuthClient) {

      this.attributes = { ...oAuthClient }
      this.originalAttributes = { ...oAuthClient }

      Object.keys(oAuthClient).forEach(key => {
        if (!(key in this)) {
           this.customColumns[key] = (oAuthClient as OAuthClientJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('oauth_clients')
    this.updateFromQuery = db.updateTable('oauth_clients')
    this.deleteFromQuery = db.deleteFrom('oauth_clients')
    this.hasSelect = false
  }

  protected async loadRelations(models: OAuthClientJsonResponse | OAuthClientJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length) return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await db
        .selectFrom(relation)
        .where('oAuthClient_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: OAuthClientJsonResponse) => {
          const records = relatedRecords.filter((record: { oAuthClient_id: number }) => {
            return record.oAuthClient_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      } else {
        const records = relatedRecords.filter((record: { oAuthClient_id: number }) => {
          return record.oAuthClient_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: OAuthClientJsonResponse | OAuthClientJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: OAuthClientJsonResponse) => {

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

  async mapCustomSetters(model: NewOAuthClient): Promise<void> {
    const customSetter = {
      default: () => {
      },

      
    }

    for (const [key, fn] of Object.entries(customSetter)) {
        (model as any)[key] = await fn()
    }
  }

  get id(): number {
    return this.attributes.id
  }

get name(): string {
      return this.attributes.name
    }

get secret(): string | undefined {
      return this.attributes.secret
    }

get provider(): string | undefined {
      return this.attributes.provider
    }

get redirect(): string {
      return this.attributes.redirect
    }

get personal_access_client(): boolean {
      return this.attributes.personal_access_client
    }

get password_client(): boolean {
      return this.attributes.password_client
    }

get revoked(): boolean {
      return this.attributes.revoked
    }

get created_at(): string | undefined {
      return this.attributes.created_at
    }

    get updated_at(): string | undefined {
      return this.attributes.updated_at
    }


  set name(value: string) {
      this.attributes.name = value
    }

set secret(value: string) {
      this.attributes.secret = value
    }

set provider(value: string) {
      this.attributes.provider = value
    }

set redirect(value: string) {
      this.attributes.redirect = value
    }

set personal_access_client(value: boolean) {
      this.attributes.personal_access_client = value
    }

set password_client(value: boolean) {
      this.attributes.password_client = value
    }

set revoked(value: boolean) {
      this.attributes.revoked = value
    }

set updated_at(value: string) {
      this.attributes.updated_at = value
    }



  static select(params: (keyof OAuthClientJsonResponse)[] | RawBuilder<string> | string): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a OAuthClient by ID
  static async find(id: number): Promise<OAuthClientModel | undefined> {
    let query = db.selectFrom('oauth_clients').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return undefined

    const instance = new OAuthClientModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<OAuthClientModel | undefined> {
    const instance = new OAuthClientModel(undefined)

    const model = await instance.applyFirst()

    const data = new OAuthClientModel(model)

    return data
  }

  static async last(): Promise<OAuthClientModel | undefined> {
    const instance = new OAuthClientModel(undefined)

    const model = await instance.applyLast()

    if (!model) return undefined

    return new OAuthClientModel(model)
  }

  static async firstOrFail(): Promise<OAuthClientModel | undefined> {
    const instance = new OAuthClientModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<OAuthClientModel[]> {
    const instance = new OAuthClientModel(undefined)

    const models = await db.selectFrom('oauth_clients').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: OAuthClientJsonResponse) => {
      return new OAuthClientModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<OAuthClientModel | undefined> {
    const instance = new OAuthClientModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<OAuthClientModel[]> {
    const instance = new OAuthClientModel(undefined)
     
    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: OAuthClientJsonResponse) => instance.parseResult(new OAuthClientModel(modelItem)))
  }

  static async latest(column: keyof OauthClientsTable = 'created_at'): Promise<OAuthClientModel | undefined> {
    const instance = new OAuthClientModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model) return undefined

    return new OAuthClientModel(model)
  }

  static async oldest(column: keyof OauthClientsTable = 'created_at'): Promise<OAuthClientModel | undefined> {
    const instance = new OAuthClientModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model) return undefined

    return new OAuthClientModel(model)
  }

  static skip(count: number): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof OauthClientsTable, ...args: [V] | [Operator, V]): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof OauthClientsTable, values: V[]): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof OauthClientsTable, range: [V, V]): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof OauthClientsTable, ...args: string[]): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: OAuthClientModel) => OAuthClientModel): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof OauthClientsTable): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof OauthClientsTable): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof OauthClientsTable, value: string): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof OauthClientsTable, order: 'asc' | 'desc'): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof OauthClientsTable): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof OauthClientsTable): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof OauthClientsTable): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof OauthClientsTable, operator: Operator, value: V): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof OauthClientsTable, operator: Operator, second: keyof OauthClientsTable): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof OauthClientsTable): Promise<number> {
    const instance = new OAuthClientModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof OauthClientsTable): Promise<number> {
    const instance = new OAuthClientModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof OauthClientsTable): Promise<number> {
    const instance = new OAuthClientModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof OauthClientsTable): Promise<number> {
    const instance = new OAuthClientModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new OAuthClientModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<OAuthClientModel[]> {
    const instance = new OAuthClientModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: OAuthClientJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof OAuthClientModel>(field: K): Promise<OAuthClientModel[K][]> {
    const instance = new OAuthClientModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: OAuthClientModel[]) => Promise<void>): Promise<void> {
    const instance = new OAuthClientModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: OAuthClientJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: OAuthClientModel[],
    paging: {
      total_records: number,
      page: number,
      total_pages: number
    },
    next_cursor: number | null
  }> {
    const instance = new OAuthClientModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: OAuthClientJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor
    }
  }

  // Instance method for creating model instances
  createInstance(data: OAuthClientJsonResponse): OAuthClientModel {
    return new OAuthClientModel(data)
  }

  async applyCreate(newOAuthClient: NewOAuthClient): Promise<OAuthClientModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOAuthClient).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key)
      ),
    ) as NewOAuthClient

    await this.mapCustomSetters(filteredValues)

    

    const result = await db.insertInto('oauth_clients')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await db.selectFrom('oauth_clients')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created OAuthClient')
    }

    
    return this.createInstance(model)
  }

  async create(newOAuthClient: NewOAuthClient): Promise<OAuthClientModel> {
    return await this.applyCreate(newOAuthClient)
  }

  static async create(newOAuthClient: NewOAuthClient): Promise<OAuthClientModel> {
    const instance = new OAuthClientModel(undefined)
    return await instance.applyCreate(newOAuthClient)
  }

  static async firstOrCreate(search: Partial<OauthClientsTable>, values: NewOAuthClient = {} as NewOAuthClient): Promise<OAuthClientModel> {
    // First try to find a record matching the search criteria
    const instance = new OAuthClientModel(undefined)

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
    const createData = { ...search, ...values } as NewOAuthClient
    return await OAuthClientModel.create(createData)
  }

  static async updateOrCreate(search: Partial<OauthClientsTable>, values: NewOAuthClient = {} as NewOAuthClient): Promise<OAuthClientModel> {
    // First try to find a record matching the search criteria
    const instance = new OAuthClientModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as OAuthClientUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewOAuthClient
    return await OAuthClientModel.create(createData)
  }

  async update(newOAuthClient: OAuthClientUpdate): Promise<OAuthClientModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOAuthClient).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key)
      ),
    ) as OAuthClientUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await db.updateTable('oauth_clients')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await db.selectFrom('oauth_clients')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OAuthClient')
      }

      
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newOAuthClient: OAuthClientUpdate): Promise<OAuthClientModel | undefined> {
    await db.updateTable('oauth_clients')
      .set(newOAuthClient)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await db.selectFrom('oauth_clients')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OAuthClient')
      }

      
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<OAuthClientModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await db.updateTable('oauth_clients')
        .set(this.attributes as OAuthClientUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await db.selectFrom('oauth_clients')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OAuthClient')
      }

      
      return this.createInstance(model)
    } else {
      // Create new record
      const result = await db.insertInto('oauth_clients')
        .values(this.attributes as NewOAuthClient)
        .executeTakeFirst()

      // Get the created data
      const model = await db.selectFrom('oauth_clients')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created OAuthClient')
      }

      
      return this.createInstance(model)
    }
  }

  static async createMany(newOAuthClient: NewOAuthClient[]): Promise<void> {
    const instance = new OAuthClientModel(undefined)

    const valuesFiltered = newOAuthClient.map((newOAuthClient: NewOAuthClient) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newOAuthClient).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewOAuthClient

      

      return filteredValues
    })

    await db.insertInto('oauth_clients')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newOAuthClient: NewOAuthClient): Promise<OAuthClientModel> {
    const result = await db.insertInto('oauth_clients')
      .values(newOAuthClient)
      .executeTakeFirst()

    const instance = new OAuthClientModel(undefined)
    const model = await db.selectFrom('oauth_clients')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created OAuthClient')
    }

    

    return instance.createInstance(model)
  }

  // Method to remove a OAuthClient
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    
    
    

    const deleted = await db.deleteFrom('oauth_clients')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    

    

    

    

    return await db.deleteFrom('oauth_clients')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): OAuthClientModel {
          const instance = new OAuthClientModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

          return instance
        } 

static whereSecret(value: string): OAuthClientModel {
          const instance = new OAuthClientModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('secret', '=', value)

          return instance
        } 

static whereProvider(value: string): OAuthClientModel {
          const instance = new OAuthClientModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('provider', '=', value)

          return instance
        } 

static whereRedirect(value: string): OAuthClientModel {
          const instance = new OAuthClientModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('redirect', '=', value)

          return instance
        } 

static wherePersonalAccessClient(value: string): OAuthClientModel {
          const instance = new OAuthClientModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('personal_access_client', '=', value)

          return instance
        } 

static wherePasswordClient(value: string): OAuthClientModel {
          const instance = new OAuthClientModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('password_client', '=', value)

          return instance
        } 

static whereRevoked(value: string): OAuthClientModel {
          const instance = new OAuthClientModel(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('revoked', '=', value)

          return instance
        } 



  static whereIn<V = number>(column: keyof OauthClientsTable, values: V[]): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  

  

  

  

  static distinct(column: keyof OAuthClientJsonResponse): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): OAuthClientModel {
    const instance = new OAuthClientModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): OAuthClientJsonResponse {
    const output = {

id: this.id,
name: this.name,
   secret: this.secret,
   provider: this.provider,
   redirect: this.redirect,
   personal_access_client: this.personal_access_client,
   password_client: this.password_client,
   revoked: this.revoked,
   
        created_at: this.created_at,

        updated_at: this.updated_at,

      ...this.customColumns,
}

    return output
  }

  parseResult(model: OAuthClientModel): OAuthClientModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof OAuthClientModel]
    }

    return model
  }

  

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<OAuthClientModel | undefined> {
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

export async function find(id: number): Promise<OAuthClientModel | undefined> {
  let query = db.selectFrom('oauth_clients').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model) return undefined

  const instance = new OAuthClientModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await OAuthClientModel.count()

  return results
}

export async function create(newOAuthClient: NewOAuthClient): Promise<OAuthClientModel> {
  const instance = new OAuthClientModel(undefined)
  return await instance.applyCreate(newOAuthClient)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('oauth_clients')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<OAuthClientModel[]> {
          const query = db.selectFrom('oauth_clients').where('name', '=', value)
          const results: OAuthClientJsonResponse = await query.execute()

          return results.map((modelItem: OAuthClientJsonResponse) => new OAuthClientModel(modelItem))
        } 

export async function whereSecret(value: string): Promise<OAuthClientModel[]> {
          const query = db.selectFrom('oauth_clients').where('secret', '=', value)
          const results: OAuthClientJsonResponse = await query.execute()

          return results.map((modelItem: OAuthClientJsonResponse) => new OAuthClientModel(modelItem))
        } 

export async function whereProvider(value: string): Promise<OAuthClientModel[]> {
          const query = db.selectFrom('oauth_clients').where('provider', '=', value)
          const results: OAuthClientJsonResponse = await query.execute()

          return results.map((modelItem: OAuthClientJsonResponse) => new OAuthClientModel(modelItem))
        } 

export async function whereRedirect(value: string): Promise<OAuthClientModel[]> {
          const query = db.selectFrom('oauth_clients').where('redirect', '=', value)
          const results: OAuthClientJsonResponse = await query.execute()

          return results.map((modelItem: OAuthClientJsonResponse) => new OAuthClientModel(modelItem))
        } 

export async function wherePersonalAccessClient(value: boolean): Promise<OAuthClientModel[]> {
          const query = db.selectFrom('oauth_clients').where('personal_access_client', '=', value)
          const results: OAuthClientJsonResponse = await query.execute()

          return results.map((modelItem: OAuthClientJsonResponse) => new OAuthClientModel(modelItem))
        } 

export async function wherePasswordClient(value: boolean): Promise<OAuthClientModel[]> {
          const query = db.selectFrom('oauth_clients').where('password_client', '=', value)
          const results: OAuthClientJsonResponse = await query.execute()

          return results.map((modelItem: OAuthClientJsonResponse) => new OAuthClientModel(modelItem))
        } 

export async function whereRevoked(value: boolean): Promise<OAuthClientModel[]> {
          const query = db.selectFrom('oauth_clients').where('revoked', '=', value)
          const results: OAuthClientJsonResponse = await query.execute()

          return results.map((modelItem: OAuthClientJsonResponse) => new OAuthClientModel(modelItem))
        } 



export const OAuthClient = OAuthClientModel

export default OAuthClient
