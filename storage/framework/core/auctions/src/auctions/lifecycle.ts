import type { AuctionItemRow, AuctionRow, AuctionSettlement, BidRow, ItemOutcome, PledgeRow } from '../types'
import { db } from '@stacksjs/database'
import { effectiveCloseAt } from '../engine/anti-snipe'
import { determineWinner, settle } from '../engine/winners'
import { broadcastItemClosed } from '../realtime'
import { currencyFor } from '../rules'
import { fetchAuction, fetchItems } from './fetch'

function isoOf(value: Date): string {
  return value.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * Open an auction for bidding.
 *
 * Lots go open with it. A lot held back deliberately (a live-auction headline
 * item that is only listed for display) keeps whatever status it already has if
 * it is not `draft`.
 */
export async function openAuction(auctionId: number, now: Date = new Date()): Promise<AuctionRow | null> {
  await db
    .updateTable('auctions')
    .set({ status: 'open', opens_at: isoOf(now) })
    .where('id', '=', auctionId)
    .execute()

  await db
    .updateTable('auction_items')
    .set({ status: 'open' })
    .where('auction_id', '=', auctionId)
    .where('status', '=', 'closed')
    .execute()

  return fetchAuction(auctionId)
}

/**
 * Close one lot and decide it.
 *
 * Returns the outcome, or null when the lot was already resolved - which makes
 * the function safe to call from a per-minute job that may overlap with an
 * organizer clicking "close now" on the same lot.
 */
export async function closeItem(item: AuctionItemRow, now: Date = new Date()): Promise<ItemOutcome | null> {
  if (item.status === 'sold' || item.status === 'passed')
    return null

  const bids = (await db
    .selectFrom('bids')
    .selectAll()
    .where('auction_item_id', '=', item.id)
    .execute()) as BidRow[] | undefined

  const outcome = determineWinner(item, bids ?? [])

  await db.transaction(async (trx: any) => {
    await trx
      .updateTable('auction_items')
      .set({ status: outcome.status, closes_at: isoOf(now) })
      .where('id', '=', item.id)
      .execute()

    if (outcome.winningBidId) {
      await trx
        .updateTable('bids')
        .set({ status: 'won' })
        .where('id', '=', outcome.winningBidId)
        .execute()
    }

    // Everything still live on this lot lost. `invalid` bids are left alone:
    // a retracted bid is not a loss, it is a correction.
    await trx
      .updateTable('bids')
      .set({ status: 'lost' })
      .where('auction_item_id', '=', item.id)
      .where('status', 'in', ['leading', 'outbid'])
      .execute()
  })

  await broadcastItemClosed(item.auction_id, item.id, {
    status: outcome.status,
    amount: outcome.amount,
    winnerName: outcome.winnerName,
  }).catch(() => undefined)

  return outcome
}

/**
 * Close every lot whose time is up, honouring anti-snipe extensions.
 *
 * This is what the per-minute job calls. It reads each lot's own close time
 * (which a late bid may have pushed out seconds ago) rather than the auction's,
 * so an extension always wins over the schedule.
 */
export async function closeDueItems(auctionId: number, now: Date = new Date()): Promise<ItemOutcome[]> {
  const auction = await fetchAuction(auctionId)
  if (!auction)
    return []

  const items = await fetchItems(auctionId)
  const outcomes: ItemOutcome[] = []

  for (const item of items) {
    if (item.status !== 'open')
      continue

    if (effectiveCloseAt(item, auction.closes_at) > now)
      continue

    const outcome = await closeItem(item, now)
    if (outcome)
      outcomes.push(outcome)
  }

  return outcomes
}

/**
 * Close the auction itself: resolve every remaining lot, then mark it closed.
 */
export async function closeAuction(auctionId: number, now: Date = new Date()): Promise<ItemOutcome[]> {
  const items = await fetchItems(auctionId)
  const outcomes: ItemOutcome[] = []

  for (const item of items) {
    const outcome = await closeItem(item, now)
    if (outcome)
      outcomes.push(outcome)
  }

  await db
    .updateTable('auctions')
    .set({ status: 'closed', closes_at: isoOf(now) })
    .where('id', '=', auctionId)
    .execute()

  return outcomes
}

/**
 * The settlement sheet: what every lot did, what the night raised, and how it
 * measured against the goal and against fair market value.
 *
 * Read-only by default. Pass `{ markSettled: true }` once the school has
 * actually invoiced, which is a decision a person makes, not a job.
 */
export async function settleAuction(auctionId: number, opts: { markSettled?: boolean, now?: Date } = {}): Promise<AuctionSettlement | null> {
  const auction = await fetchAuction(auctionId)
  if (!auction)
    return null

  const items = await fetchItems(auctionId)

  const bids = (await db
    .selectFrom('bids')
    .selectAll()
    .where('auction_id', '=', auctionId)
    .execute()) as BidRow[] | undefined

  const pledges = (await db
    .selectFrom('pledges')
    .selectAll()
    .where('auction_id', '=', auctionId)
    .execute()) as PledgeRow[] | undefined

  const bidsByItem = new Map<number, BidRow[]>()
  for (const bid of bids ?? []) {
    const list = bidsByItem.get(bid.auction_item_id) ?? []
    list.push(bid)
    bidsByItem.set(bid.auction_item_id, list)
  }

  // A lot that already closed keeps the outcome it closed with; an open lot is
  // reported on its bids as they stand, so the sheet is meaningful mid-auction
  // as well as after it.
  const outcomes = items.map((item) => {
    const outcome = determineWinner(item, bidsByItem.get(item.id) ?? [])
    return item.status === 'passed' ? { ...outcome, status: 'passed' as const } : outcome
  })

  if (opts.markSettled) {
    await db
      .updateTable('auctions')
      .set({ status: 'settled' })
      .where('id', '=', auctionId)
      .execute()
  }

  return settle(items, outcomes, pledges ?? [], {
    auctionId,
    currency: currencyFor(auction),
    goalAmount: auction.goal_amount ?? null,
  })
}

/**
 * Lots that close within `withinMinutes`, for the "closing soon" notice and for
 * the organizer's watchlist of items still short of their fair market value.
 */
export async function closingSoon(auctionId: number, withinMinutes: number, now: Date = new Date()): Promise<AuctionItemRow[]> {
  const auction = await fetchAuction(auctionId)
  if (!auction)
    return []

  const cutoff = new Date(now.getTime() + withinMinutes * 60_000)

  return (await fetchItems(auctionId)).filter((item) => {
    if (item.status !== 'open')
      return false
    const closes = effectiveCloseAt(item, auction.closes_at)
    return closes > now && closes <= cutoff
  })
}
