import type { AuctionItemRow, BidRow } from '../src/auctions/types'
import { describe, expect, it } from 'bun:test'
import { extendedCloseAt } from '../src/auctions/engine/anti-snipe'
import { DEFAULT_INCREMENT_LADDER, incrementFor, nextMinimumBid } from '../src/auctions/engine/increments'
import { resolveBid } from '../src/auctions/engine/proxy'
import { determineWinner, settle } from '../src/auctions/engine/winners'

/** $ to cents, so the tests read like a bid sheet. */
function usd(dollars: number): number {
  return Math.round(dollars * 100)
}

function item(overrides: Partial<AuctionItemRow> = {}): AuctionItemRow {
  return {
    id: 1,
    auction_id: 1,
    lot_number: 1,
    title: 'Faculty parking spot for a term',
    starting_bid: usd(50),
    min_increment: null,
    buy_now_price: null,
    reserve_price: null,
    fair_market_value: usd(400),
    status: 'open',
    closes_at: null,
    extension_count: 0,
    ...overrides,
  }
}

function leading(amount: number, max: number | null, email = 'first@example.com', name = 'First Bidder'): Pick<BidRow, 'bidder_email' | 'bidder_name' | 'amount' | 'max_amount'> {
  return { bidder_email: email, bidder_name: name, amount, max_amount: max }
}

function bid(overrides: Partial<BidRow> = {}): BidRow {
  return {
    id: 1,
    auction_item_id: 1,
    auction_id: 1,
    bidder_name: 'Bidder',
    bidder_email: 'bidder@example.com',
    amount: usd(100),
    max_amount: null,
    status: 'leading',
    placed_at: '2026-05-01 19:00:00',
    ...overrides,
  }
}

describe('increment ladder', () => {
  it('steps by more as the money gets bigger', () => {
    expect(incrementFor(usd(20))).toBe(usd(2))
    expect(incrementFor(usd(75))).toBe(usd(5))
    expect(incrementFor(usd(200))).toBe(usd(10))
    expect(incrementFor(usd(400))).toBe(usd(25))
    expect(incrementFor(usd(900))).toBe(usd(50))
    expect(incrementFor(usd(2000))).toBe(usd(100))
    expect(incrementFor(usd(9000))).toBe(usd(250))
  })

  it('treats a tier boundary as belonging to the tier above it', () => {
    // $50 exactly is no longer in the "under $50" rung.
    expect(incrementFor(usd(50))).toBe(usd(5))
  })

  it("lets a lot's own increment override the ladder entirely", () => {
    expect(incrementFor(usd(20), DEFAULT_INCREMENT_LADDER, usd(100))).toBe(usd(100))
    expect(incrementFor(usd(9000), DEFAULT_INCREMENT_LADDER, usd(100))).toBe(usd(100))
  })

  it('opens at the starting bid rather than one increment above it', () => {
    expect(nextMinimumBid(item({ starting_bid: usd(50) }), null)).toBe(usd(50))
    expect(nextMinimumBid(item({ starting_bid: usd(50) }), usd(50))).toBe(usd(55))
  })
})

describe('proxy bidding', () => {
  it('accepts the first bid at the starting price', () => {
    const result = resolveBid(item(), null, { bidderEmail: 'a@example.com', bidderName: 'A', amount: usd(50) })

    expect(result.accepted).toBe(true)
    expect(result.leader?.amount).toBe(usd(50))
    expect(result.leader?.isChallenger).toBe(true)
    expect(result.nextMinimumBid).toBe(usd(55))
  })

  it('rejects a bid under the next minimum', () => {
    // $100 sits in the $10 rung, so the next bid is $110.
    const result = resolveBid(item(), leading(usd(100), usd(100)), { bidderEmail: 'b@example.com', bidderName: 'B', amount: usd(103) })

    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('below_minimum')
    expect(result.nextMinimumBid).toBe(usd(110))
  })

  it('rejects a maximum below the stated bid as a form error', () => {
    const result = resolveBid(item(), null, { bidderEmail: 'b@example.com', bidderName: 'B', amount: usd(200), maxAmount: usd(100) })

    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('max_below_amount')
  })

  it('lets the loser set the price: a big ceiling wins by one increment, not by its size', () => {
    // Standing leader is willing to go to $300. The challenger is willing to go
    // to $1000 and should take the lead at $325 - one $25 rung over the
    // leader's ceiling - not at $1000.
    const result = resolveBid(item(), leading(usd(200), usd(300)), { bidderEmail: 'b@example.com', bidderName: 'B', amount: usd(210), maxAmount: usd(1000) })

    expect(result.accepted).toBe(true)
    expect(result.leader?.bidderEmail).toBe('b@example.com')
    expect(result.leader?.amount).toBe(usd(325))
    expect(result.outbid?.bidderEmail).toBe('first@example.com')
  })

  it("pushes the standing leader's visible price up when a challenger cannot beat their ceiling", () => {
    // Challenger tops out at $250 against a $500 ceiling: the leader stays, but
    // the price moves to one $25 rung over what the challenger offered.
    const result = resolveBid(item(), leading(usd(200), usd(500)), { bidderEmail: 'b@example.com', bidderName: 'B', amount: usd(250) })

    expect(result.accepted).toBe(true)
    expect(result.leader?.bidderEmail).toBe('first@example.com')
    expect(result.leader?.isChallenger).toBe(false)
    expect(result.leader?.amount).toBe(usd(275))
    // The challenger is the one who gets the outbid notice, immediately.
    expect(result.outbid?.bidderEmail).toBe('b@example.com')
    expect(result.challengerAmount).toBe(usd(250))
  })

  it('never lets the standing leader exceed their own ceiling', () => {
    const result = resolveBid(item(), leading(usd(200), usd(255)), { bidderEmail: 'b@example.com', bidderName: 'B', amount: usd(250) })

    expect(result.leader?.amount).toBe(usd(255))
  })

  it('gives an exact tie to whoever committed first', () => {
    const result = resolveBid(item(), leading(usd(200), usd(500)), { bidderEmail: 'b@example.com', bidderName: 'B', amount: usd(500) })

    expect(result.accepted).toBe(true)
    expect(result.leader?.bidderEmail).toBe('first@example.com')
    expect(result.leader?.amount).toBe(usd(500))
    expect(result.outbid?.bidderEmail).toBe('b@example.com')
  })

  it('does not charge a bidder for outbidding themselves', () => {
    const result = resolveBid(item(), leading(usd(200), usd(300)), { bidderEmail: 'first@example.com', bidderName: 'First Bidder', amount: usd(210), maxAmount: usd(900) })

    expect(result.accepted).toBe(true)
    expect(result.leader?.isChallenger).toBe(false)
    // Visible price unchanged; only the private ceiling moved.
    expect(result.leader?.amount).toBe(usd(200))
    expect(result.leader?.maxAmount).toBe(usd(900))
    expect(result.outbid).toBeUndefined()
  })

  it('rejects a leader re-bidding at or below their existing ceiling', () => {
    const result = resolveBid(item(), leading(usd(200), usd(300)), { bidderEmail: 'first@example.com', bidderName: 'First Bidder', amount: usd(250) })

    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('already_leading')
  })

  it('is case-insensitive about who the bidder is', () => {
    const result = resolveBid(item(), leading(usd(200), usd(300), 'First@Example.com'), { bidderEmail: 'first@example.com', bidderName: 'First Bidder', amount: usd(400) })

    expect(result.leader?.isChallenger).toBe(false)
  })

  it('sells outright at the buy-now price and outbids the standing leader', () => {
    const result = resolveBid(item({ buy_now_price: usd(600) }), leading(usd(200), usd(300)), { bidderEmail: 'b@example.com', bidderName: 'B', amount: usd(600) })

    expect(result.buyNow).toBe(true)
    expect(result.leader?.amount).toBe(usd(600))
    expect(result.outbid?.bidderEmail).toBe('first@example.com')
  })

  it('reaches buy-now through a proxy ceiling, not only through the typed amount', () => {
    const result = resolveBid(item({ buy_now_price: usd(600) }), null, { bidderEmail: 'b@example.com', bidderName: 'B', amount: usd(60), maxAmount: usd(700) })

    expect(result.buyNow).toBe(true)
    expect(result.challengerAmount).toBe(usd(600))
  })
})

describe('anti-sniping', () => {
  const rules = { antiSnipeMinutes: 2, extendOnBidWindowMinutes: 2, maxExtensions: 3 }
  const closesAt = new Date('2026-05-01T20:00:00Z')

  it('extends the close when a bid lands inside the window', () => {
    const now = new Date('2026-05-01T19:59:10Z')
    const extended = extendedCloseAt(item(), closesAt, rules, now)

    expect(extended?.toISOString()).toBe('2026-05-01T20:01:10.000Z')
  })

  it('leaves an early bid alone', () => {
    const now = new Date('2026-05-01T19:50:00Z')

    expect(extendedCloseAt(item(), closesAt, rules, now)).toBeNull()
  })

  it('stops extending once the lot has hit its extension cap', () => {
    const now = new Date('2026-05-01T19:59:10Z')

    expect(extendedCloseAt(item({ extension_count: 3 }), closesAt, rules, now)).toBeNull()
  })

  it('does nothing for a bid that arrives after the close', () => {
    const now = new Date('2026-05-01T20:00:01Z')

    expect(extendedCloseAt(item(), closesAt, rules, now)).toBeNull()
  })

  it('never pulls a close time backwards', () => {
    // A ten-minute window with a one-minute extension would otherwise shorten
    // the lot by nine minutes.
    const now = new Date('2026-05-01T19:52:00Z')
    const shortExtension = { antiSnipeMinutes: 1, extendOnBidWindowMinutes: 10, maxExtensions: 3 }

    expect(extendedCloseAt(item(), closesAt, shortExtension, now)).toBeNull()
  })

  it('is off entirely when the auction sets zero minutes', () => {
    const now = new Date('2026-05-01T19:59:10Z')

    expect(extendedCloseAt(item(), closesAt, { ...rules, antiSnipeMinutes: 0 }, now)).toBeNull()
  })
})

describe('winners', () => {
  it('passes a lot nobody bid on', () => {
    const outcome = determineWinner(item(), [])

    expect(outcome.status).toBe('passed')
    expect(outcome.passedReason).toBe('no_bids')
  })

  it('picks the highest bid', () => {
    const outcome = determineWinner(item(), [
      bid({ id: 1, amount: usd(100), bidder_email: 'a@example.com' }),
      bid({ id: 2, amount: usd(250), bidder_email: 'b@example.com' }),
    ])

    expect(outcome.status).toBe('sold')
    expect(outcome.winningBidId).toBe(2)
    expect(outcome.amount).toBe(usd(250))
  })

  it('breaks a tie on who bid first', () => {
    const outcome = determineWinner(item(), [
      bid({ id: 1, amount: usd(250), placed_at: '2026-05-01 19:30:00', bidder_email: 'late@example.com' }),
      bid({ id: 2, amount: usd(250), placed_at: '2026-05-01 19:05:00', bidder_email: 'early@example.com' }),
    ])

    expect(outcome.winningBidId).toBe(2)
    expect(outcome.winnerEmail).toBe('early@example.com')
  })

  it('ignores retracted bids', () => {
    const outcome = determineWinner(item(), [
      bid({ id: 1, amount: usd(900), status: 'invalid' }),
      bid({ id: 2, amount: usd(250) }),
    ])

    expect(outcome.winningBidId).toBe(2)
  })

  it('passes a lot whose top bid missed the reserve', () => {
    const outcome = determineWinner(item({ reserve_price: usd(500) }), [bid({ amount: usd(250) })])

    expect(outcome.status).toBe('passed')
    expect(outcome.passedReason).toBe('reserve_not_met')
  })
})

describe('settlement', () => {
  const items = [
    { id: 1, fair_market_value: usd(400) },
    { id: 2, fair_market_value: usd(1000) },
    { id: 3, fair_market_value: null },
  ]

  const outcomes = [
    { itemId: 1, lotNumber: 1, title: 'Parking spot', status: 'sold' as const, amount: usd(600), winnerEmail: 'a@example.com' },
    { itemId: 2, lotNumber: 2, title: 'Vacation week', status: 'sold' as const, amount: usd(900), winnerEmail: 'b@example.com' },
    { itemId: 3, lotNumber: 3, title: 'Class art project', status: 'passed' as const, amount: 0, passedReason: 'no_bids' as const },
  ]

  const pledges = [
    { id: 1, auction_id: 1, donor_name: 'C', donor_email: 'c@example.com', amount: usd(2500), status: 'confirmed' as const },
    { id: 2, auction_id: 1, donor_name: 'D', donor_email: 'd@example.com', amount: usd(1000), status: 'cancelled' as const },
  ]

  it('adds winning bids and confirmed pledges, and ignores cancelled ones', () => {
    const result = settle(items, outcomes, pledges, { auctionId: 1, currency: 'USD', goalAmount: usd(5000) })

    expect(result.bidRevenue).toBe(usd(1500))
    expect(result.pledgeRevenue).toBe(usd(2500))
    expect(result.totalRaised).toBe(usd(4000))
  })

  it('reports sell-through over lots offered', () => {
    const result = settle(items, outcomes, pledges, { auctionId: 1, currency: 'USD' })

    expect(result.itemsSold).toBe(2)
    expect(result.itemsPassed).toBe(1)
    expect(result.sellThrough).toBeCloseTo(2 / 3)
  })

  it('measures paid against fair market value, skipping lots with no stated value', () => {
    // Lot 1 went $200 over, lot 2 went $100 under, lot 3 has no value to compare.
    const result = settle(items, outcomes, pledges, { auctionId: 1, currency: 'USD' })

    expect(result.valueDelta).toBe(usd(100))
  })

  it('does not divide by zero on an empty catalogue', () => {
    const result = settle([], [], [], { auctionId: 1, currency: 'USD' })

    expect(result.sellThrough).toBe(0)
    expect(result.totalRaised).toBe(0)
  })
})
