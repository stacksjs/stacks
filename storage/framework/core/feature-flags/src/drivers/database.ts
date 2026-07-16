import type { DatabaseFeatureFlagDriverOptions, FeatureDatabaseClient, FeatureDriver, FeatureValue } from '../types'
import { FeatureFlagStoreError } from '../errors'
import { normalizeFeatureValue } from '../value'
import { ensureFeatureFlagTable, featureFlagTableName } from '../schema'

interface FeatureFlagRow {
  name: string
  scope: string
  value: string
}

function serialize(value: FeatureValue): string {
  return JSON.stringify(normalizeFeatureValue(value))
}

function deserialize(row: Pick<FeatureFlagRow, 'name' | 'value'>): FeatureValue {
  try {
    return normalizeFeatureValue(JSON.parse(row.value))
  }
  catch (error) {
    throw new FeatureFlagStoreError(`Stored value for feature '${row.name}' is invalid JSON.`, { cause: error })
  }
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string, message?: string } | null
  const message = candidate?.message ?? ''
  return candidate?.code === '23505'
    || candidate?.code === 'ER_DUP_ENTRY'
    || /unique constraint|duplicate entry/i.test(message)
}

export class DatabaseFeatureFlagDriver implements FeatureDriver {
  readonly table: string
  private readonly ready: Promise<void>

  constructor(
    private readonly database: FeatureDatabaseClient,
    options: DatabaseFeatureFlagDriverOptions = {},
  ) {
    this.table = featureFlagTableName(options.table)
    this.ready = options.autoCreate
      ? ensureFeatureFlagTable(database, { table: this.table, dialect: options.dialect })
      : Promise.resolve()
  }

  async get(name: string, scopeKey: string): Promise<FeatureValue | undefined> {
    await this.ready
    const row = await this.database
      .selectFrom(this.table)
      .where('name', '=', name)
      .where('scope', '=', scopeKey)
      .select(['name', 'value'])
      .executeTakeFirst() as FeatureFlagRow | undefined
    return row ? deserialize(row) : undefined
  }

  async set(name: string, scopeKey: string, value: FeatureValue): Promise<void> {
    await this.ready
    const serialized = serialize(value)
    const now = new Date().toISOString()
    const existing = await this.database
      .selectFrom(this.table)
      .where('name', '=', name)
      .where('scope', '=', scopeKey)
      .select(['name'])
      .executeTakeFirst()

    if (existing) {
      await this.update(name, scopeKey, serialized, now)
      return
    }

    try {
      await this.database
        .insertInto(this.table)
        .values({ name, scope: scopeKey, value: serialized, created_at: now, updated_at: now })
        .execute()
    }
    catch (error) {
      // Another process may have inserted the same flag between SELECT and
      // INSERT. The unique (name, scope) index makes retry-as-update atomic.
      if (!isUniqueViolation(error)) throw error
      await this.update(name, scopeKey, serialized, now)
    }
  }

  private async update(name: string, scopeKey: string, value: string, updatedAt: string): Promise<void> {
    await this.database
      .updateTable(this.table)
      .set({ value, updated_at: updatedAt })
      .where('name', '=', name)
      .where('scope', '=', scopeKey)
      .execute()
  }

  async delete(name: string, scopeKey: string): Promise<void> {
    await this.ready
    await this.database
      .deleteFrom(this.table)
      .where('name', '=', name)
      .where('scope', '=', scopeKey)
      .execute()
  }

  async deleteForAllScopes(names?: readonly string[]): Promise<void> {
    await this.ready
    if (!names) {
      await this.clear()
      return
    }
    for (const name of new Set(names)) {
      await this.database
        .deleteFrom(this.table)
        .where('name', '=', name)
        .execute()
    }
  }

  async clear(): Promise<void> {
    await this.ready
    await this.database.deleteFrom(this.table).execute()
  }

  async stored(scopeKey: string): Promise<Record<string, FeatureValue>> {
    await this.ready
    const rows = await this.database
      .selectFrom(this.table)
      .where('scope', '=', scopeKey)
      .select(['name', 'value'])
      .execute() as FeatureFlagRow[]
    const result: Record<string, FeatureValue> = {}
    for (const row of rows) {
      Object.defineProperty(result, row.name, {
        value: deserialize(row),
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    return result
  }
}

export function createDatabaseFeatureFlagDriver(
  database: FeatureDatabaseClient,
  options?: DatabaseFeatureFlagDriverOptions,
): DatabaseFeatureFlagDriver {
  return new DatabaseFeatureFlagDriver(database, options)
}
