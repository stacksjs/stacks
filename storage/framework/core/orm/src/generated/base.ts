import { cache } from '@stacksjs/cache'
import { ModelNotFoundException } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

export class BaseOrm {
  // Method to find a record by ID
  static async find<T>(tableName: string, id: number): Promise<T | undefined> {
    const model = await DB.instance.selectFrom(tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`${tableName}:${id}`, JSON.stringify(model))

    return model as T
  }

  // Method to find a record by ID or fail
  static async findOrFail<T>(tableName: string, modelName: string, id: number): Promise<T> {
    const model = await DB.instance.selectFrom(tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ${modelName} results for ${id}`)

    cache.getOrSet(`${tableName}:${id}`, JSON.stringify(model))

    return model as T
  }

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
