export type Operator = '=' | '<' | '>' | '<=' | '>=' | '<>' | '!=' | 'like' | 'not like' | 'in' | 'not in' | 'between' | 'not between' | 'is' | 'is not'

interface WhereCondition<T, V = any> {
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

  where<V>(column: keyof T, ...args: [V] | [Operator, V]): void {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue as Operator
    const actualValue: V = value === undefined ? operatorOrValue as V : value

    this.addCondition('and', 'where', column, operator, actualValue)
  }

  orWhere<V>(column: keyof T, ...args: [V] | [Operator, V]): void {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue as Operator
    const actualValue: V = value === undefined ? operatorOrValue as V : value

    this.addCondition('or', 'where', column, operator, actualValue)
  }

  whereIn<V>(column: keyof T, values: V[]): void {
    this.conditions.push({
      type: 'and',
      method: 'whereIn',
      column,
      values,
    } as WhereCondition<T, V>)
  }

  whereNotIn<V>(column: keyof T, values: V[]): void {
    this.conditions.push({
      type: 'and',
      method: 'whereIn',
      column,
      values,
      operator: 'not in',
    } as WhereCondition<T, V>)
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

  whereBetween<V>(column: keyof T, range: [V, V]): void {
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

  private addCondition<V>(type: 'and' | 'or', method: 'where', column: keyof T, operator: Operator, value: V): void {
    this.conditions.push({ type, method, column, operator, value })
  }

  getConditions(): WhereCondition<T>[] {
    return this.conditions
  }
}
