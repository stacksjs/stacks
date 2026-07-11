import type { DynamoDBClientConfig } from './client';
import type { DynamoDBMigrationPlan, DynamoDBMigrationState } from './migrations';
/**
 * Create a migration driver instance
 */
export declare function createMigrationDriver(config: MigrationDriverConfig): DynamoDBMigrationDriver;
/**
 * Migrate models with default configuration
 */
export declare function migrateModels(models: any[], config: MigrationDriverConfig): Promise<MigrationResult[]>;
// ============================================================================
// Types
// ============================================================================
export declare interface MigrationDriverConfig extends DynamoDBClientConfig {
  dryRun?: boolean
  verbose?: boolean
}
export declare interface MigrationResult {
  tableName: string
  success: boolean
  operations: string[]
  error?: string
  state?: DynamoDBMigrationState
}
/**
 * Executes DynamoDB schema migrations
 */
export declare class DynamoDBMigrationDriver {
  constructor(config: MigrationDriverConfig);
  execute(plan: DynamoDBMigrationPlan): Promise<MigrationResult>;
  migrateModel(ModelClass: any): Promise<MigrationResult>;
  migrateModels(models: any[]): Promise<MigrationResult[]>;
  getStatus(): Promise<Map<string, DynamoDBMigrationState | null>>;
}
