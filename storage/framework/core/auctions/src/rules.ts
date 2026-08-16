import type { AuctionRow, AuctionRules, IncrementTier } from './types'
import { config } from '@stacksjs/config'
import { DEFAULT_INCREMENT_LADDER } from './engine/increments'

interface AuctionConfigShape {
  currency?: string
  increments?: IncrementTier[]
  antiSnipeMinutes?: number
  extendOnBidWindowMinutes?: number
  maxExtensions?: number
}

function auctionConfig(): AuctionConfigShape {
  return ((config as unknown as { auction?: AuctionConfigShape }).auction) ?? {}
}

/**
 * The rules in force for one auction: the app's `config/auction.ts` defaults,
 * with the auction row's own columns winning where they are set.
 *
 * Per-auction overrides matter because one school runs both a two-week online
 * catalogue (long extensions, forgiving windows) and a ninety-minute in-room
 * gala (two-minute extensions, or none at all) in the same season, and neither
 * should have to be the global default.
 */
export function rulesFor(auction?: Pick<AuctionRow, 'anti_snipe_minutes' | 'extend_on_bid_window_minutes' | 'max_extensions'> | null): AuctionRules {
  const cfg = auctionConfig()

  return {
    increments: cfg.increments?.length ? cfg.increments : DEFAULT_INCREMENT_LADDER,
    antiSnipeMinutes: auction?.anti_snipe_minutes ?? cfg.antiSnipeMinutes ?? 2,
    extendOnBidWindowMinutes: auction?.extend_on_bid_window_minutes ?? cfg.extendOnBidWindowMinutes ?? 2,
    maxExtensions: auction?.max_extensions ?? cfg.maxExtensions ?? 20,
  }
}

/** The auction's currency, falling back to the app-wide default. */
export function currencyFor(auction?: Pick<AuctionRow, 'currency'> | null): string {
  return auction?.currency ?? auctionConfig().currency ?? 'USD'
}
