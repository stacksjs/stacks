export class Column {
  constructor(public name: string, public type: string, public options: any = {}) {}

  notNullable(): this {
    this.options.notNull = true;
    return this;
  }

  defaultTo(value: any): this {
    this.options.default = value;
    return this;
  }
}
