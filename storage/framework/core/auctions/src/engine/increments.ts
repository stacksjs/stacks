import type { AuctionItemRow, IncrementTier } from '../types'

/**
 * The default increment ladder, in cents.
 *
 * A flat increment is wrong at both ends of a gala catalogue: $5 steps turn a
 * $4,000 vacation package into a hundred-bid slog, and $100 steps price
 * everyone out of the $60 class art project. The ladder is what a live
 * auctioneer does by instinct - bigger money moves in bigger steps.
 *
 * Tiers are read in order and the first whose `upTo` exceeds the current
 * amount wins, so they must stay sorted ascending with a single `null` last.
 */
export const DEFAULT_INCREMENT_LADDER: IncrementTier[] = [
  { upTo: 5_000, step: 200 }, //        under $50  -> $2
  { upTo: 10_000, step: 500 }, //       under $100 -> $5
  { upTo: 25_000, step: 1_000 }, //     under $250 -> $10
  { upTo: 50_000, step: 2_500 }, //     under $500 -> $25
  { upTo: 100_000, step: 5_000 }, //    under $1k  -> $50
  { upTo: 250_000, step: 10_000 }, //   under $2.5k -> $100
  { upTo: null, step: 25_000 }, //      above      -> $250
]

/**
 * The increment that applies at `amount`.
 *
 * A lot's own `min_increment` overrides the ladder entirely - that is the
 * escape hatch for the lot that wants round hundreds regardless of where the
 * bidding starts.
 */
export function incrementFor(amount: number, ladder: IncrementTier[] = DEFAULT_INCREMENT_LADDER, itemIncrement?: number | null): number {
  if (itemIncrement && itemIncrement > 0)
    return itemIncrement

  for (const tier of ladder) {
    if (tier.upTo === null || amount < tier.upTo)
      return tier.step
  }

  // Only reachable if a caller passes a ladder with no open-ended rung.
  return ladder[ladder.length - 1]?.step ?? 100
}

/**
 * The smallest bid that can be placed on this lot right now.
 *
 * With no bids yet that is the starting bid itself, not the starting bid plus
 * an increment: the first bidder should be able to type the number printed on
 * the bid sheet.
 */
export function nextMinimumBid(item: Pick<AuctionItemRow, 'starting_bid' | 'min_increment'>, leadingAmount: number | null, ladder: IncrementTier[] = DEFAULT_INCREMENT_LADDER): number {
  if (leadingAmount === null || leadingAmount <= 0)
    return item.starting_bid

  return leadingAmount + incrementFor(leadingAmount, ladder, item.min_increment)
}
