/**
 * Clear the query cache
 */
export declare function cacheClear(): Promise<void>;
/**
 * Show cache statistics and configuration
 *
 * Note: The current cache implementation doesn't track detailed statistics.
 * This command shows the current configuration.
 */
export declare function cacheStats(): Promise<void>;
/**
 * Configure query cache settings
 */
export declare function cacheConfig(options?: CacheConfigOptions): Promise<void>;
export declare interface CacheConfigOptions {
  size?: number
}
