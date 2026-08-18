import type { AuctionItemRow, AuctionRow } from '../types'
import { db } from '@stacksjs/database'
import { nextMinimumBid } from '../engine/increments'
import { rulesFor } from '../rules'

export async function fetchAuction(id: number): Promise<AuctionRow | null> {
  const row = await db
    .selectFrom('auctions')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()

  return (row as AuctionRow | undefined) ?? null
}

/** The auction attached to an event, which is how the public page finds it. */
export async function fetchAuctionForEvent(eventId: number): Promise<AuctionRow | null> {
  const row = await db
    .selectFrom('auctions')
    .selectAll()
    .where('event_id', '=', eventId)
    .executeTakeFirst()

  return (row as AuctionRow | undefined) ?? null
}

export async function fetchItems(auctionId: number): Promise<AuctionItemRow[]> {
  const rows = await db
    .selectFrom('auction_items')
    .selectAll()
    .where('auction_id', '=', auctionId)
    .orderBy('lot_number', 'asc')
    .execute()

  return (rows ?? []) as unknown as AuctionItemRow[]
}

export interface ItemWithBidState extends AuctionItemRow {
  currentBid: number
  bidCount: number
  /** What the bid form should prefill. */
  nextMinimumBid: number
  leaderName: string | null
}

/**
 * The catalogue as a bidder sees it: every lot with its current price, how
 * contested it is, and the number to beat.
 *
 * One grouped query rather than a query per lot - a gala catalogue is a hundred
 * lots and the page is opened by a few hundred phones at once, so the N+1 here
 * would be the whole evening's load.
 *
 * Proxy ceilings are not selected. They must never reach a template.
 */
export async function fetchCatalogue(auctionId: number): Promise<ItemWithBidState[]> {
  const [auction, items] = await Promise.all([fetchAuction(auctionId), fetchItems(auctionId)])
  const rules = rulesFor(auction)

  const leaders = (await db
    .selectFrom('bids')
    .select(['auction_item_id', 'amount', 'bidder_name'])
    .where('auction_id', '=', auctionId)
    .where('status', 'in', ['leading', 'won'])
    .execute()) as { auction_item_id: number, amount: number, bidder_name: string }[] | undefined

  const counts = (await db
    .selectFrom('bids')
    .select(['auction_item_id'])
    .where('auction_id', '=', auctionId)
    .where('status', '!=', 'invalid')
    .execute()) as { auction_item_id: number }[] | undefined

  const leaderBy = new Map((leaders ?? []).map(l => [l.auction_item_id, l]))
  const countBy = new Map<number, number>()
  for (const row of counts ?? [])
    countBy.set(row.auction_item_id, (countBy.get(row.auction_item_id) ?? 0) + 1)

  return items.map((item) => {
    const leader = leaderBy.get(item.id) ?? null
    return {
      ...item,
      currentBid: leader?.amount ?? 0,
      bidCount: countBy.get(item.id) ?? 0,
      nextMinimumBid: nextMinimumBid(item, leader?.amount ?? null, rules.increments),
      leaderName: leader?.bidder_name ?? null,
    }
  })
}

export interface AuctionTotals {
  /** Money currently committed by leading bids, in cents. */
  currentBidTotal: number
  pledgeTotal: number
  raised: number
  goalAmount: number | null
  bidCount: number
  bidderCount: number
  lotsOffered: number
  lotsWithBids: number
}

/**
 * The live numbers behind the gala monitor: what the room has committed so far,
 * against the goal.
 */
export async function auctionTotals(auctionId: number): Promise<AuctionTotals> {
  const auction = await fetchAuction(auctionId)

  const live = (await db
    .selectFrom('bids')
    .select(['auction_item_id', 'amount', 'bidder_email', 'status'])
    .where('auction_id', '=', auctionId)
    .where('status', '!=', 'invalid')
    .execute()) as { auction_item_id: number, amount: number, bidder_email: string, status: string }[] | undefined

  const pledges = (await db
    .selectFrom('pledges')
    .select(['amount'])
    .where('auction_id', '=', auctionId)
    .where('status', '=', 'confirmed')
    .execute()) as { amount: number }[] | undefined

  const bids = live ?? []
  const committed = bids.filter(b => b.status === 'leading' || b.status === 'won')
  const currentBidTotal = committed.reduce((sum, b) => sum + b.amount, 0)
  const pledgeTotal = (pledges ?? []).reduce((sum, p) => sum + p.amount, 0)

  const lotsOffered = await db
    .selectFrom('auction_items')
    .where('auction_id', '=', auctionId)
    .count()

  return {
    currentBidTotal,
    pledgeTotal,
    raised: currentBidTotal + pledgeTotal,
    goalAmount: auction?.goal_amount ?? null,
    bidCount: bids.length,
    bidderCount: new Set(bids.map(b => b.bidder_email.toLowerCase())).size,
    lotsOffered: Number(lotsOffered ?? 0),
    lotsWithBids: new Set(bids.map(b => b.auction_item_id)).size,
  }
}
