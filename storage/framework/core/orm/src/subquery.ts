type Operator = '=' | '<' | '>' | '<=' | '>=' | '<>' | '!=' | 'like' | 'not like' | 'in' | 'not in' | 'between' | 'not between' | 'is' | 'is not'

interface WhereCondition<T, V = any> {
  type: 'and' | 'or'
  method: 'where' | 'whereIn' | 'whereNull' | 'whereNotNull' | 'whereBetween' | 'whereExists'
  column: keyof T
  operator?: Operator
  value?: V
  values?: V[]
  callback?: (query: SubqueryBuilder<T>) => void
}

export class SubqueryBuilder<T> {
  private conditions: WhereCondition<T>[] = []

  where<V>(column: keyof T, valueOrOperator: Operator, value?: V): void {
    if (value === undefined) {
      this.addCondition('and', 'where', column, '=', valueOrOperator as any)
    }
    else {
      this.addCondition('and', 'where', column, valueOrOperator, value)
    }
  }

  orWhere<V>(column: keyof T, valueOrOperator: Operator, value?: V): void {
    if (value === undefined) {
      this.addCondition('or', 'where', column, '=', valueOrOperator as any)
    }
    else {
      this.addCondition('or', 'where', column, valueOrOperator, value)
    }
  }

  whereIn<V>(column: keyof T, values: V[]): void {
    this.conditions.push({
      type: 'and',
      method: 'whereIn',
      column,
      values,
    })
  }

  whereNotIn<V>(column: keyof T, values: V[]): void {
    this.conditions.push({
      type: 'and',
      method: 'whereIn',
      column,
      values,
      operator: 'not in',
    })
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
      values: range,
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