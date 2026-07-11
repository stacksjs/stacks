import type { SupportedDialect } from '@/types';
/**
 * Optimize database tables (VACUUM, ANALYZE, OPTIMIZE)
 */
export declare function dbOptimize(options?: OptimizeOptions): Promise<void>;
export declare interface OptimizeOptions {
  dialect?: SupportedDialect
  aggressive?: boolean
  tables?: string[]
  verbose?: boolean
}
export { dbOptimize as optimizeDatabase };
