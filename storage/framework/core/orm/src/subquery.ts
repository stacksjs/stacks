import { HttpError } from '@stacksjs/error-handling'

interface WhereCondition {
  type: 'and' | 'or'
  method: 'where' | 'whereIn' | 'whereNull' | 'whereNotNull' | 'whereBetween' | 'whereExists'
  column: string
  operator?: string
  value?: any
  values?: any[]
  callback?: (query: SubqueryBuilder) => void
}

export class SubqueryBuilder {
  private conditions: WhereCondition[] = []

  where(...args: (string | number | boolean | undefined | null)[]): void {
    this.addCondition('and', 'where', ...args)
  }

  orWhere(...args: (string | number | boolean | undefined | null)[]): void {
    this.addCondition('or', 'where', ...args)
  }

  whereIn(column: string, values: any[]): void {
    this.conditions.push({
      type: 'and',
      method: 'whereIn',
      column,
      values,
    })
  }

  whereNotIn(column: string, values: any[]): void {
    this.conditions.push({
      type: 'and',
      method: 'whereIn',
      column,
      values,
      operator: 'not',
    })
  }

  whereNull(column: string) {
    this.conditions.push({
      type: 'and',
      method: 'whereNull',
      column,
    })
  }

  whereNotNull(column: string): void {
    this.conditions.push({
      type: 'and',
      method: 'whereNotNull',
      column,
    })
  }

  whereBetween(column: string, range: [any, any]): void {
    this.conditions.push({
      type: 'and',
      method: 'whereBetween',
      column,
      values: range,
    })
  }

  whereExists(callback: (query: SubqueryBuilder) => void): void {
    this.conditions.push({
      type: 'and',
      method: 'whereExists',
      column: '',
      callback,
    })
  }

  private addCondition(type: 'and' | 'or', method: 'where', ...args: (string | number | boolean | undefined | null)[]): void {
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

    this.conditions.push({ type, method, column, operator, value })
  }

  getConditions(): WhereCondition[] {
    return this.conditions
  }
}
