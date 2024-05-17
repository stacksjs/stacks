interface Options {
  notNull?: boolean
  default?: any
  primaryKey?: boolean
  autoIncrement?: boolean
}

type ColumnType = 'integer' | 'varchar' | 'timestamp' | `varchar(${number})`

export class Column {
  constructor(
    public name: string,
    public type: ColumnType,
    public options: Options = {},
  ) {}

  notNullable(): this {
    this.options.notNull = true
    return this
  }

  defaultTo(value: any): this {
    this.options.default = value
    return this
  }

  primary(): this {
    this.options.primaryKey = true
    return this
  }

  autoIncrement(): this {
    this.options.autoIncrement = true
    return this
  }
}
