/**
 * Get migration status - shows which migrations have been executed and which are pending
 */
export declare function migrateStatus(): Promise<MigrationStatus[]>;
/**
 * List all migrations (alias for status)
 */
export declare function migrateList(): Promise<MigrationStatus[]>;
export declare interface MigrationStatus {
  file: string
  status: 'executed' | 'pending' | 'transient'
  executedAt?: string
}
