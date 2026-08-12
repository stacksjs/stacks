export type Operator = '=' | '<' | '>' | '<=' | '>=' | '<>' | '!=' | 'like' | 'not like' | 'in' | 'not in' | 'between' | 'not between' | 'is' | 'is not'

interface WhereCondition<T, V = unknown> {
  type: 'and' | 'or'
  method: 'where' | 'whereIn' | 'whereNull' | 'whereNotNull' | 'whereBetween' | 'whereExists'
  column: keyof T
  operator?: Operator
  value?: V
  values?: V[] | [V, V]
  range?: [V, V]
  callback?: (query: SubqueryBuilder<T>) => void
}

export class SubqueryBuilder<T> {
  private conditions: WhereCondition<T>[] = []

  where<TKey extends keyof T>(column: TKey, ...args: [T[TKey]] | [Operator, T[TKey]]): void {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue as Operator
    const actualValue: T[TKey] = value === undefined ? operatorOrValue as T[TKey] : value

    this.addCondition('and', 'where', column, operator, actualValue)
  }

  orWhere<TKey extends keyof T>(column: TKey, ...args: [T[TKey]] | [Operator, T[TKey]]): void {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue as Operator
    const actualValue: T[TKey] = value === undefined ? operatorOrValue as T[TKey] : value

    this.addCondition('or', 'where', column, operator, actualValue)
  }

  whereIn<TKey extends keyof T>(column: TKey, values: T[TKey][]): void {
    this.conditions.push({
      type: 'and',
      method: 'whereIn',
      column,
      values,
    } as WhereCondition<T, T[TKey]>)
  }

  whereNotIn<TKey extends keyof T>(column: TKey, values: T[TKey][]): void {
    this.conditions.push({
      type: 'and',
      method: 'whereIn',
      column,
      values,
      operator: 'not in',
    } as WhereCondition<T, T[TKey]>)
  }

  whereNull(column: keyof T): void {
    this.conditions.push({
      type: 'and',
      method: 'whereNull',
      column,
    })
  }

  whereNotNull(column: keyof T): void {
    this.conditions.push({
      type: 'and',
      method: 'whereNotNull',
      column,
    })
  }

  whereBetween<TKey extends keyof T>(column: TKey, range: [T[TKey], T[TKey]]): void {
    this.conditions.push({
      type: 'and',
      method: 'whereBetween',
      column,
      range,
    })
  }

  whereExists(callback: (query: SubqueryBuilder<T>) => void): void {
    this.conditions.push({
      type: 'and',
      method: 'whereExists',
      column: '' as keyof T,
      callback,
    })
  }

  private addCondition<TKey extends keyof T>(type: 'and' | 'or', method: 'where', column: TKey, operator: Operator, value: T[TKey]): void {
    this.conditions.push({ type, method, column, operator, value })
  }

  getConditions(): WhereCondition<T>[] {
    return this.conditions
  }
}
