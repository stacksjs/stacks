/**
 * Compare-and-set usage reservations.
 *
 * The implementation is generic and lives in `@stacksjs/hq/meter`, where the
 * HQ services share it. This module keeps the names newsletter has always
 * exported, so `@stacksjs/newsletter` and `@stacksjs/newsletter/usage` are
 * unchanged for their callers.
 */
export { releaseUsage, reserveUsage, UsageQuotaError } from '@stacksjs/hq/meter'
export type { UsageQuotaErrorCode, UsageQuotaSnapshot, UsageQuotaStore, UsageReservation } from '@stacksjs/hq/meter'
