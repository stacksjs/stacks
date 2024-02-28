export class Column {
  constructor(public name: string, public type: string, public options: any = {}) {}

  notNullable(): this {
    this.options.notNull = true;
    return this;
  }

  // Add other methods for column definitions as needed
}
