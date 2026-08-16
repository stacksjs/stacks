import type { AuctionItemRow, AuctionSettlement, BidRow, ItemOutcome, PledgeRow } from '../types'

/**
 * Decide a single lot's outcome from its bids.
 *
 * Ordering is explicit rather than inherited from whatever the query returned:
 * highest amount wins, and the earlier bid wins a tie. Two bids can legitimately
 * share an amount when one bidder's proxy stepped up to exactly another's
 * ceiling, and "first to commit" is the rule every bid sheet has always used.
 */
export function determineWinner(item: Pick<AuctionItemRow, 'id' | 'lot_number' | 'title' | 'reserve_price'>, bids: BidRow[]): ItemOutcome {
  const live = bids.filter(b => b.status !== 'invalid')

  if (live.length === 0) {
    return {
      itemId: item.id,
      lotNumber: item.lot_number,
      title: item.title,
      status: 'passed',
      amount: 0,
      passedReason: 'no_bids',
    }
  }

  const sorted = [...live].sort((a, b) => {
    if (b.amount !== a.amount)
      return b.amount - a.amount
    return new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()
  })

  const top = sorted[0]!

  if (item.reserve_price && top.amount < item.reserve_price) {
    return {
      itemId: item.id,
      lotNumber: item.lot_number,
      title: item.title,
      status: 'passed',
      amount: top.amount,
      passedReason: 'reserve_not_met',
    }
  }

  return {
    itemId: item.id,
    lotNumber: item.lot_number,
    title: item.title,
    status: 'sold',
    winningBidId: top.id,
    winnerName: top.bidder_name,
    winnerEmail: top.bidder_email,
    amount: top.amount,
  }
}

/**
 * Roll a set of lot outcomes and pledges into the number the school actually
 * cares about.
 *
 * `valueDelta` compares winning bids against fair market value. It is the
 * honest read on a catalogue: a positive delta means donors paid over the value
 * of what they took home, which is the point of a benefit auction; a negative
 * one means the room got bargains and the procurement committee has a
 * conversation to have. Lots with no stated value are excluded rather than
 * counted as zero, which would make every catalogue look like a loss.
 */
export function settle(items: Pick<AuctionItemRow, 'id' | 'fair_market_value'>[], outcomes: ItemOutcome[], pledges: PledgeRow[], opts: { auctionId: number, currency: string, goalAmount?: number | null } ): AuctionSettlement {
  const sold = outcomes.filter(o => o.status === 'sold')
  const passed = outcomes.filter(o => o.status === 'passed')
  const bidRevenue = sold.reduce((sum, o) => sum + o.amount, 0)
  const pledgeRevenue = pledges
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount, 0)

  const valueByItem = new Map(items.map(i => [i.id, i.fair_market_value ?? null]))
  const valueDelta = sold.reduce((delta, o) => {
    const fmv = valueByItem.get(o.itemId)
    return fmv == null ? delta : delta + (o.amount - fmv)
  }, 0)

  const offered = outcomes.length

  return {
    auctionId: opts.auctionId,
    currency: opts.currency,
    totalRaised: bidRevenue + pledgeRevenue,
    bidRevenue,
    pledgeRevenue,
    goalAmount: opts.goalAmount ?? null,
    itemsSold: sold.length,
    itemsPassed: passed.length,
    sellThrough: offered === 0 ? 0 : sold.length / offered,
    valueDelta,
    outcomes,
  }
}
