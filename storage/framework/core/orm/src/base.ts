import type { Operator } from '@stacksjs/orm'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { DB } from '@stacksjs/orm'

export class BaseOrm<T, C> {
  protected tableName: string

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean = false

  constructor(tableName: string) {
    this.tableName = tableName

    this.selectFromQuery = DB.instance.selectFrom(this.tableName)
    this.updateFromQuery = DB.instance.updateTable(this.tableName)
    this.deleteFromQuery = DB.instance.deleteFrom(this.tableName)
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

    cache.getOrSet(`${this.tableName}:${id}`, JSON.stringify(model))

    return model
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

  // Methods to be implemented by child classes
  protected mapCustomGetters(_model: T): void {}

  protected async loadRelations(_model: T): Promise<void> {}

  // // Method to get the first record
  // static async first<T>(tableName: string): Promise<T | undefined> {
  //   const model = await DB.instance.selectFrom(tableName)
  //     .selectAll()
  //     .executeTakeFirst()

  //   return model as T | undefined
  // }

  // // Method to get the first record or fail
  // static async firstOrFail<T>(tableName: string, modelName: string): Promise<T> {
  //   const model = await DB.instance.selectFrom(tableName)
  //     .selectAll()
  //     .executeTakeFirst()

  //   if (model === undefined)
  //     throw new ModelNotFoundException(404, `No ${modelName} results found for query`)

  //   return model as T
  // }

  // // Method to get all records
  // static async all<T>(tableName: string): Promise<T[]> {
  //   const models = await DB.instance.selectFrom(tableName)
  //     .selectAll()
  //     .execute()

  //   return models as T[]
  // }

  // // Method to create a record
  // static async create<T>(tableName: string, data: any, eventName?: string): Promise<T> {
  //   const result = await DB.instance.insertInto(tableName)
  //     .values(data)
  //     .executeTakeFirst()

  //   const model = await this.find<T>(tableName, Number(result.numInsertedOrUpdatedRows))

  //   if (model && eventName)
  //     dispatch(eventName, model)

  //   return model as T
  // }

  // // Method to update a record
  // static async update<T>(tableName: string, id: number, data: any, eventName?: string): Promise<T | undefined> {
  //   await DB.instance.updateTable(tableName)
  //     .set(data)
  //     .where('id', '=', id)
  //     .executeTakeFirst()

  //   const model = await this.find<T>(tableName, id)

  //   if (model && eventName)
  //     dispatch(eventName, model)

  //   return model
  // }

  // // Method to delete a record
  // static async delete(tableName: string, id: number, eventName?: string): Promise<any> {
  //   const model = await this.find(tableName, id)

  //   if (model && eventName)
  //     dispatch(eventName, model)

  //   return await DB.instance.deleteFrom(tableName)
  //     .where('id', '=', id)
  //     .execute()
  // }
}
