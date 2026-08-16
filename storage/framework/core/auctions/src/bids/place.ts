import type { AuctionItemRow, AuctionRow, BidRequest, BidRow, PlacedBid } from '../types'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { effectiveCloseAt, extendedCloseAt } from '../engine/anti-snipe'
import { nextMinimumBid } from '../engine/increments'
import { resolveBid } from '../engine/proxy'
import { broadcastBid } from '../realtime'
import { rulesFor } from '../rules'
import { leadingBid } from './fetch'

function isoOf(value: Date): string {
  return value.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * Place a bid.
 *
 * The decision of what should happen is the pure engine's
 * (`resolveBid`); everything here is the consequences: which rows change, what
 * the lot's close time becomes, and who needs to be told. Keeping the two apart
 * is what lets a bidding war be tested without a database and a database write
 * be reviewed without re-deriving the auction rules.
 *
 * Every write runs in one transaction. A silent auction's worst failure mode is
 * two `leading` bids on one lot - two people are told they won the same
 * vacation package, and someone has to call one of them back.
 */
export async function placeBid(request: BidRequest): Promise<PlacedBid> {
  const now = request.now ?? new Date()

  const item = (await db
    .selectFrom('auction_items')
    .selectAll()
    .where('id', '=', request.itemId)
    .executeTakeFirst()) as AuctionItemRow | undefined

  if (!item) {
    return {
      accepted: false,
      reason: 'item_not_found',
      message: 'That lot is no longer available.',
      nextMinimumBid: 0,
    }
  }

  const auction = (await db
    .selectFrom('auctions')
    .selectAll()
    .where('id', '=', item.auction_id)
    .executeTakeFirst()) as AuctionRow | undefined

  const rules = rulesFor(auction)
  const leader = await leadingBid(item.id)
  const minimum = nextMinimumBid(item, leader?.amount ?? null, rules.increments)

  if (!auction || auction.status !== 'open' || new Date(auction.opens_at) > now) {
    return {
      accepted: false,
      reason: 'auction_not_open',
      message: 'Bidding is not open yet.',
      nextMinimumBid: minimum,
      item,
    }
  }

  const closesAt = effectiveCloseAt(item, auction.closes_at)

  if (item.status !== 'open' || closesAt <= now) {
    return {
      accepted: false,
      reason: 'item_not_open',
      message: 'Bidding on this lot has closed.',
      nextMinimumBid: minimum,
      item,
    }
  }

  const resolution = resolveBid(item, leader, {
    bidderEmail: request.bidderEmail,
    bidderName: request.bidderName,
    amount: request.amount,
    maxAmount: request.maxAmount,
  }, rules.increments)

  if (!resolution.accepted)
    return { ...resolution, item }

  const extendTo = resolution.buyNow
    ? null
    : extendedCloseAt(item, closesAt, rules, now)

  // The leader raising their own ceiling. No new row: the visible price does
  // not move, nobody is outbid, and inserting a second `leading`-adjacent row
  // for the same bidder would double-count them in every activity feed. The
  // proxy ceiling on the existing row is what changes.
  const isSelfRaise = resolution.leader && !resolution.leader.isChallenger
    && leader && leader.bidder_email.toLowerCase() === request.bidderEmail.toLowerCase()

  const placed = await db.transaction(async (trx: any) => {
    if (isSelfRaise && leader) {
      await trx
        .updateTable('bids')
        .set({ max_amount: resolution.leader!.maxAmount })
        .where('id', '=', leader.id)
        .execute()

      return { ...leader, max_amount: resolution.leader!.maxAmount } as BidRow
    }

    // The incoming bid is recorded either way - as the new leader, or as the
    // outbid bid that pushed the leader's proxy up. Both are real money
    // offered and both belong in the lot's history.
    const takesLead = resolution.leader?.isChallenger === true
    const uuid = randomUUIDv7()

    await trx
      .insertInto('bids')
      .values({
        uuid,
        auction_id: item.auction_id,
        auction_item_id: item.id,
        bidder_name: request.bidderName,
        bidder_email: request.bidderEmail.toLowerCase(),
        amount: resolution.challengerAmount ?? request.amount,
        max_amount: request.maxAmount ?? null,
        status: takesLead ? 'leading' : 'outbid',
        placed_at: isoOf(now),
      })
      .execute()

    if (leader) {
      if (takesLead) {
        await trx
          .updateTable('bids')
          .set({ status: 'outbid' })
          .where('id', '=', leader.id)
          .execute()
      }
      else if (resolution.leader && resolution.leader.amount !== leader.amount) {
        // The standing leader's proxy answered the challenge: their visible
        // amount rises, their ceiling and their row are otherwise untouched.
        await trx
          .updateTable('bids')
          .set({ amount: resolution.leader.amount })
          .where('id', '=', leader.id)
          .execute()
      }
    }

    if (resolution.buyNow) {
      await trx
        .updateTable('auction_items')
        .set({ status: 'sold', closes_at: isoOf(now) })
        .where('id', '=', item.id)
        .execute()
    }
    else if (extendTo) {
      await trx
        .updateTable('auction_items')
        .set({ closes_at: isoOf(extendTo), extension_count: item.extension_count + 1 })
        .where('id', '=', item.id)
        .execute()
    }

    const row = await trx
      .selectFrom('bids')
      .selectAll()
      .where('uuid', '=', uuid)
      .executeTakeFirst()

    return row as BidRow
  })

  const result: PlacedBid = {
    ...resolution,
    bid: placed,
    item: {
      ...item,
      status: resolution.buyNow ? 'sold' : item.status,
      closes_at: extendTo ? isoOf(extendTo) : item.closes_at,
      extension_count: extendTo ? item.extension_count + 1 : item.extension_count,
    },
    extendedTo: extendTo ?? undefined,
  }

  // Fire-and-forget: a websocket that is down must never fail a bid that the
  // database has already accepted.
  await broadcastBid(result).catch(() => undefined)

  return result
}
