import type { GenerateMigrationResult, MigrateOptions } from '@/types';
/**
 * Generate migration files by comparing the stored model snapshot with current models.
 *
 * Workflow:
 * 1. Loads the previous migration plan from `.qb/model-snapshot.{dialect}.json`
 * 2. Loads current models from the source directory and builds a new migration plan
 * 3. Compares both plans to detect all changes:
 *    - Dropped tables, columns, indexes
 *    - New tables, columns, indexes
 *    - Modified columns (type changes, etc.)
 * 4. Generates SQL migration files for only the detected differences
 * 5. Saves the current plan as the new snapshot for future comparisons
 *
 * This follows Laravel's migration philosophy where model changes drive schema changes.
 * Simply update your models and run migrations - the system automatically figures out what changed.
 */
export declare function generateMigration(dir?: string, opts?: MigrateOptions): Promise<GenerateMigrationResult>;
export declare function executeMigration(dir?: string): Promise<boolean>;
export declare function resetDatabase(dir?: string, opts?: MigrateOptions): Promise<boolean>;
export declare function deleteMigrationFiles(dir?: string, workspaceRoot?: string, opts?: MigrateOptions): Promise<void>;
/**
 * @deprecated This function is no longer needed. Model snapshots are now stored as JSON migration plans.
 * Keeping for backward compatibility but this is now a no-op.
 */
export declare function copyModelsToGenerated(_dir?: string, _workspaceRoot?: string): Promise<void>;
/**
 * Clear the generated directory to force fresh migration generation
 * This is called during migrate:fresh to ensure all models are treated as new
 */
export declare function clearGeneratedDirectory(workspaceRoot?: string): Promise<void>;
