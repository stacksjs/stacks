import type { GenerateMigrationResult, MigrateOptions } from '@/types';
/**
 * Generate migration files from model changes (alias for generateMigration)
 */
export declare function migrateGenerate(dir?: string, opts?: MigrateOptions): Promise<GenerateMigrationResult>;
export { migrateGenerate as generateMigration };
