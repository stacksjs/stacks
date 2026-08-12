import type { BackupResourceKind, JsonValue } from '@stacksjs/ts-cloud'

export const RECOVERY_KINDS: BackupResourceKind[] = [
  'managed_database',
  'logical_database',
  'volume',
  'files',
  'control_plane',
  'infrastructure',
]

export function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(stringValue).filter(Boolean)
    : typeof value === 'string'
      ? value.split(',').map(entry => entry.trim()).filter(Boolean)
      : []
}

export function positiveNumber(value: unknown, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.min(maximum, number) : fallback
}

export function jsonObject(value: unknown): Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}
  return value as Record<string, JsonValue>
}
