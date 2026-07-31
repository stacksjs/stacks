export interface KanbanModelRecord {
  get: (key: string) => unknown
}

export interface RefreshableKanbanModelRecord extends KanbanModelRecord {
  fresh: () => Promise<KanbanModelRecord | null>
}

export async function refreshModel(record: RefreshableKanbanModelRecord): Promise<KanbanModelRecord> {
  return await record.fresh() ?? record
}

export function modelValue(record: KanbanModelRecord, camelKey: string, snakeKey = camelKey): unknown {
  const camelValue = record.get(camelKey)
  if (camelValue !== undefined)
    return camelValue
  return record.get(snakeKey)
}

export function modelNumber(record: KanbanModelRecord, camelKey: string, snakeKey = camelKey): number {
  return Number(modelValue(record, camelKey, snakeKey))
}

export function modelString(record: KanbanModelRecord, camelKey: string, snakeKey = camelKey): string {
  const value = modelValue(record, camelKey, snakeKey)
  return value === undefined || value === null ? '' : String(value)
}

export function modelNullableString(record: KanbanModelRecord, camelKey: string, snakeKey = camelKey): string | null {
  const value = modelValue(record, camelKey, snakeKey)
  return value === undefined || value === null ? null : String(value)
}

export function modelBoolean(record: KanbanModelRecord, camelKey: string, snakeKey = camelKey): boolean {
  const value = modelValue(record, camelKey, snakeKey)
  return value === true || value === 1 || value === '1' || value === 'true'
}
