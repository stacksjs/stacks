export interface KanbanModelRecord {
  get: (key: string) => unknown
}

export interface RefreshableKanbanModelRecord extends KanbanModelRecord {
  fresh: () => Promise<KanbanModelRecord | null>
}

export async function refreshModel(record: RefreshableKanbanModelRecord): Promise<KanbanModelRecord> {
  return await record.fresh() ?? record
}

export function modelValue(record: object, camelKey: string, snakeKey = camelKey): unknown {
  const model = record as Partial<KanbanModelRecord>
  const row = record as Record<string, unknown>
  const camelValue = typeof model.get === 'function' ? model.get(camelKey) : row[camelKey]
  if (camelValue !== undefined)
    return camelValue
  return typeof model.get === 'function' ? model.get(snakeKey) : row[snakeKey]
}

export function modelNumber(record: object, camelKey: string, snakeKey = camelKey): number {
  return Number(modelValue(record, camelKey, snakeKey))
}

export function modelNullableNumber(record: object, camelKey: string, snakeKey = camelKey): number | null {
  const value = modelValue(record, camelKey, snakeKey)
  return value === undefined || value === null ? null : Number(value)
}

export function modelString(record: object, camelKey: string, snakeKey = camelKey): string {
  const value = modelValue(record, camelKey, snakeKey)
  return value === undefined || value === null ? '' : String(value)
}

export function modelNullableString(record: object, camelKey: string, snakeKey = camelKey): string | null {
  const value = modelValue(record, camelKey, snakeKey)
  return value === undefined || value === null ? null : String(value)
}

export function modelBoolean(record: object, camelKey: string, snakeKey = camelKey): boolean {
  const value = modelValue(record, camelKey, snakeKey)
  return value === true || value === 1 || value === '1' || value === 'true'
}
