import type { SupportedDialect } from '@/types';
/**
 * Drop all tables in the database
 */
export declare function dbWipe(options?: WipeOptions): Promise<void>;
export declare interface WipeOptions {
  dialect?: SupportedDialect
  force?: boolean
  verbose?: boolean
}
export { dbWipe as wipeDatabase };
