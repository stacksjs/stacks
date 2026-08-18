import type { BidRow } from '../types'
import { db } from '@stacksjs/database'

/**
 * The bid currently winning a lot, or null when nobody has bid.
 *
 * There is exactly one `leading` row per open lot; `placeBid` maintains that
 * invariant inside a transaction. `orderBy` is still spelled out so a stray
 * second row (a hand-edited record, a restored backup) resolves to the highest
 * one rather than to whatever the storage engine returns first.
 */
export async function leadingBid(itemId: number): Promise<BidRow | null> {
  const row = await db
    .selectFrom('bids')
    .selectAll()
    .where('auction_item_id', '=', itemId)
    .where('status', '=', 'leading')
    .orderBy('amount', 'desc')
    .executeTakeFirst()

  return (row as BidRow | undefined) ?? null
}

/** Every bid on a lot, newest first - the lot's activity feed. */
export async function bidsForItem(itemId: number): Promise<BidRow[]> {
  const rows = await db
    .selectFrom('bids')
    .selectAll()
    .where('auction_item_id', '=', itemId)
    .orderBy('placed_at', 'desc')
    .execute()

  return (rows ?? []) as unknown as BidRow[]
}

/** Every bid in an auction, oldest first - the settlement input. */
export async function bidsForAuction(auctionId: number): Promise<BidRow[]> {
  const rows = await db
    .selectFrom('bids')
    .selectAll()
    .where('auction_id', '=', auctionId)
    .orderBy('placed_at', 'asc')
    .execute()

  return (rows ?? []) as unknown as BidRow[]
}

/**
 * One bidder's bids across an auction, for the "your bids" panel a parent
 * refreshes all night and for addressing outbid notices.
 */
export async function bidsByBidder(auctionId: number, bidderEmail: string): Promise<BidRow[]> {
  const rows = await db
    .selectFrom('bids')
    .selectAll()
    .where('auction_id', '=', auctionId)
    .where('bidder_email', '=', bidderEmail.toLowerCase())
    .orderBy('placed_at', 'desc')
    .execute()

  return (rows ?? []) as unknown as BidRow[]
}

/** Distinct bidders in an auction, for audience resolution on notifications. */
export async function biddersFor(auctionId: number): Promise<{ name: string, email: string }[]> {
  const rows = (await db
    .selectFrom('bids')
    .select(['bidder_name', 'bidder_email'])
    .where('auction_id', '=', auctionId)
    .execute()) as { bidder_name: string, bidder_email: string }[] | undefined

  const seen = new Map<string, { name: string, email: string }>()
  for (const row of rows ?? []) {
    const key = row.bidder_email.toLowerCase()
    if (!seen.has(key))
      seen.set(key, { name: row.bidder_name, email: row.bidder_email })
  }

  return [...seen.values()]
}
