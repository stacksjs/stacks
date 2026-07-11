import { DynamoDBClient } from './client';
import type { DynamoDBMigrationState } from './migrations';
import type { DynamoDBTableDefinition } from '../drivers/dynamodb';
// ============================================================================
// Constants
// ============================================================================
declare const MIGRATIONS_TABLE: '_qb_migrations';
/**
 * Tracks and manages DynamoDB migration state
 */
export declare class DynamoDBMigrationTracker {
  constructor(client: DynamoDBClient);
  ensureMigrationsTable(): Promise<void>;
  getLatestState(tableName: string): Promise<DynamoDBMigrationState | null>;
  getHistory(tableName: string): Promise<DynamoDBMigrationState[]>;
  recordMigration(tableName: string, definition: DynamoDBTableDefinition, version?: number): Promise<DynamoDBMigrationState>;
  listTrackedTables(): Promise<string[]>;
  hasMigrations(tableName: string): Promise<boolean>;
  deleteMigrationHistory(tableName: string): Promise<void>;
}
// ============================================================================
// Exports
// ============================================================================
export { MIGRATIONS_TABLE };
