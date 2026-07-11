import type { RunSeederOptions, SeederConfig } from '@/seeder';
/**
 * Run all seeders from a directory
 */
export declare function runSeeders(config?: SeederConfig): Promise<void>;
/**
 * Run a specific seeder by class name
 */
export declare function runSeeder(className: string, options?: RunSeederOptions): Promise<void>;
/**
 * Generate a new seeder file
 */
export declare function makeSeeder(name: string): Promise<void>;
/**
 * Refresh database and run all seeders
 * This will drop all tables and re-run migrations and seeders
 */
export declare function freshDatabase(options?: { seedersDir?: string, modelsDir?: string, verbose?: boolean }): Promise<void>;
