import type { PlacedBid, PledgeRow } from './types'

/**
 * The channel an auction's live updates are published on. One channel per
 * auction rather than per lot: a gala's bidding page shows the whole catalogue
 * at once, and a phone in a gym should hold one socket, not forty.
 */
export function auctionChannel(auctionId: number): string {
  return `auction.${auctionId}`
}

/**
 * Realtime is an optional feature bundle. Importing it eagerly would drag the
 * websocket server into every app that only wants to run a paper-free bid sheet
 * on a cron, so it is resolved at call time and a missing package degrades to
 * "no live updates" rather than to a crash.
 */
async function emitter(): Promise<((channel: string, event: string, payload: unknown) => unknown) | null> {
  try {
    const realtime = await import('@stacksjs/realtime') as { emit?: (channel: string, event: string, payload: unknown) => unknown }
    return realtime.emit ?? null
  }
  catch {
    return null
  }
}

/**
 * Publish a bid to everyone watching the auction.
 *
 * The payload carries the new price and the next minimum rather than a
 * "refresh" signal, so a phone that is already on the lot updates in place. It
 * deliberately does NOT carry proxy ceilings: the hidden maximum is the one
 * number that must never leave the server, or the whole mechanism collapses.
 */
export async function broadcastBid(result: PlacedBid): Promise<void> {
  const emit = await emitter()
  if (!emit || !result.item || !result.leader)
    return

  await emit(auctionChannel(result.item.auction_id), 'bid.placed', {
    itemId: result.item.id,
    lotNumber: result.item.lot_number,
    amount: result.leader.amount,
    nextMinimumBid: result.nextMinimumBid,
    leaderName: result.leader.bidderName,
    status: result.item.status,
    closesAt: result.item.closes_at,
    extended: Boolean(result.extendedTo),
    soldViaBuyNow: Boolean(result.buyNow),
  })
}

/** Publish a fund-a-need pledge, for the running total on the tally board. */
export async function broadcastPledge(pledge: PledgeRow, runningTotal: number): Promise<void> {
  const emit = await emitter()
  if (!emit)
    return

  await emit(auctionChannel(pledge.auction_id), 'pledge.made', {
    donorName: pledge.donor_name,
    amount: pledge.amount,
    level: pledge.level ?? null,
    runningTotal,
  })
}

/** Publish a lot closing, so open bid sheets stop accepting input. */
export async function broadcastItemClosed(auctionId: number, itemId: number, outcome: { status: string, amount: number, winnerName?: string }): Promise<void> {
  const emit = await emitter()
  if (!emit)
    return

  await emit(auctionChannel(auctionId), 'item.closed', { itemId, ...outcome })
}
