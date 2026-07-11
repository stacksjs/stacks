/**
 * Helper function to create a seeder
 */
export declare function defineSeeder(seederClass: new () => Seeder): new () => Seeder;
/**
 * Seeder configuration options
 */
export declare interface SeederConfig {
  seedersDir?: string
  seeders?: string[]
  verbose?: boolean
}
/**
 * Options for running seeders
 */
export declare interface RunSeederOptions {
  class?: string
  verbose?: boolean
}
/**
 * Base seeder class that all seeders should extend.
 * Provides access to query builder and faker for generating test data.
 */
export declare abstract class Seeder {
  abstract run(qb: any): Promise<void>;
  get order(): number;
  get description(): string | undefined;
}
