import type { Operator } from '@stacksjs/orm'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

export class BaseOrm<T, C> {
  protected tableName: string

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected withRelations: string[]
  protected hasSelect: boolean = false

  constructor(tableName: string) {
    this.tableName = tableName

    this.selectFromQuery = DB.instance.selectFrom(this.tableName)
    this.updateFromQuery = DB.instance.updateTable(this.tableName)
    this.deleteFromQuery = DB.instance.deleteFrom(this.tableName)

    this.withRelations = []
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

  with(relations: string[]): this {
    this.withRelations = relations

    return this
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

  applyOrderBy(column: keyof C, order: 'asc' | 'desc'): this {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  orderBy(column: keyof C, order: 'asc' | 'desc'): this {
    return this.orderBy(column, order)
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

  applyInRandomOrder(): this {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  inRandomOrder(): this {
    return this.applyInRandomOrder()
  }

  applyOrderByDesc(column: keyof C): this {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  applyOrderByAsc(column: keyof C): this {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  orderByDesc(column: keyof C): this {
    return this.applyOrderByDesc(column)
  }

  orderByAsc(column: keyof C): this {
    return this.applyOrderByAsc(column)
  }

  // Methods to be implemented by child classes
  protected mapCustomGetters(_model: T): void {}

  protected async loadRelations(_model: T): Promise<void> {}
}
