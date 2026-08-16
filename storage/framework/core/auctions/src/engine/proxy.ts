import type { AuctionItemRow, BidResolution, BidRow, IncrementTier } from '../types'
import { DEFAULT_INCREMENT_LADDER, incrementFor, nextMinimumBid } from './increments'

/**
 * The bid a challenger is offering, reduced to what the engine needs.
 */
export interface IncomingBid {
  bidderEmail: string
  bidderName: string
  amount: number
  maxAmount?: number | null
}

/** The current leader, or null when nobody has bid on the lot yet. */
export type LeadingBid = Pick<BidRow, 'bidder_email' | 'bidder_name' | 'amount' | 'max_amount'> | null

/**
 * Resolve one incoming bid against the standing leader.
 *
 * This is proxy bidding, the model every online auction has converged on: a
 * bidder states a ceiling, and the house bids on their behalf in increments
 * only as far as it must. The visible number is therefore almost never the
 * ceiling - it is one increment above whatever the losing side was willing to
 * pay, which is exactly the price discovery a paper bid sheet cannot do.
 *
 * The function is pure. It reads no clock, touches no database, and returns
 * what *should* happen; `placeBid` is what makes it so. That split is what
 * makes the interesting cases - a ceiling war, a tie, a bidder raising their
 * own maximum - testable without a gala.
 */
export function resolveBid(item: Pick<AuctionItemRow, 'starting_bid' | 'min_increment' | 'buy_now_price'>, leader: LeadingBid, incoming: IncomingBid, ladder: IncrementTier[] = DEFAULT_INCREMENT_LADDER): BidResolution {
  const ceiling = Math.max(incoming.amount, incoming.maxAmount ?? 0)
  const minimum = nextMinimumBid(item, leader ? leader.amount : null, ladder)

  // A ceiling below the stated bid is a form entry error, not a bid. Catching
  // it here means the caller never has to reason about which of the two
  // numbers is authoritative.
  if (incoming.maxAmount != null && incoming.maxAmount < incoming.amount) {
    return {
      accepted: false,
      reason: 'max_below_amount',
      message: 'Your maximum bid has to be at least as much as your bid.',
      nextMinimumBid: minimum,
    }
  }

  if (ceiling < minimum) {
    return {
      accepted: false,
      reason: 'below_minimum',
      message: `The next bid on this lot is ${minimum / 100}.`,
      nextMinimumBid: minimum,
    }
  }

  // Buy-now short-circuits everything: the lot sells at the posted price and
  // stops taking bids, so no increment logic applies.
  if (item.buy_now_price && ceiling >= item.buy_now_price) {
    return {
      accepted: true,
      buyNow: true,
      leader: {
        bidderEmail: incoming.bidderEmail,
        bidderName: incoming.bidderName,
        amount: item.buy_now_price,
        maxAmount: item.buy_now_price,
        isChallenger: true,
      },
      challengerAmount: item.buy_now_price,
      outbid: leader
        ? { bidderEmail: leader.bidder_email, bidderName: leader.bidder_name, amount: leader.amount }
        : undefined,
      nextMinimumBid: item.buy_now_price,
    }
  }

  // First bid on the lot.
  if (!leader) {
    const amount = Math.max(item.starting_bid, incoming.amount)
    return {
      accepted: true,
      leader: {
        bidderEmail: incoming.bidderEmail,
        bidderName: incoming.bidderName,
        amount,
        maxAmount: incoming.maxAmount ?? null,
        isChallenger: true,
      },
      challengerAmount: amount,
      nextMinimumBid: amount + incrementFor(amount, ladder, item.min_increment),
    }
  }

  const leaderCeiling = Math.max(leader.amount, leader.max_amount ?? 0)
  const sameBidder = leader.bidder_email.toLowerCase() === incoming.bidderEmail.toLowerCase()

  // The leader raising their own ceiling. Nobody is bidding against them, so
  // the visible price must not move - charging someone for outbidding
  // themselves is the single most complained-about bug in auction software.
  if (sameBidder) {
    if (ceiling <= leaderCeiling) {
      return {
        accepted: false,
        reason: 'already_leading',
        message: 'You are already the leading bidder at or above that amount.',
        nextMinimumBid: minimum,
      }
    }

    return {
      accepted: true,
      leader: {
        bidderEmail: leader.bidder_email,
        bidderName: leader.bidder_name,
        amount: leader.amount,
        maxAmount: ceiling,
        isChallenger: false,
      },
      challengerAmount: leader.amount,
      nextMinimumBid: leader.amount + incrementFor(leader.amount, ladder, item.min_increment),
    }
  }

  // The challenger outbids the standing ceiling: they take the lead at one
  // increment over what the old leader was willing to pay, capped at their own
  // ceiling. This is why a $500 ceiling beats a $300 ceiling at $310 rather
  // than at $500 - the loser sets the price, not the winner.
  if (ceiling > leaderCeiling) {
    const stepped = leaderCeiling + incrementFor(leaderCeiling, ladder, item.min_increment)
    const amount = Math.min(ceiling, Math.max(stepped, minimum))

    return {
      accepted: true,
      leader: {
        bidderEmail: incoming.bidderEmail,
        bidderName: incoming.bidderName,
        amount,
        maxAmount: incoming.maxAmount ?? null,
        isChallenger: true,
      },
      challengerAmount: amount,
      outbid: {
        bidderEmail: leader.bidder_email,
        bidderName: leader.bidder_name,
        amount: leader.amount,
      },
      nextMinimumBid: amount + incrementFor(amount, ladder, item.min_increment),
    }
  }

  // The challenger cleared the minimum but not the leader's hidden ceiling.
  // The bid is real and is recorded - it is what pushes the price up - but it
  // is born outbid, and the bidder is told immediately rather than discovering
  // it in a closing email.
  //
  // The tie (`ceiling === leaderCeiling`) lands here deliberately: equal money
  // goes to whoever committed first.
  const stepped = ceiling + incrementFor(ceiling, ladder, item.min_increment)
  const leaderAmount = Math.min(leaderCeiling, Math.max(stepped, ceiling))

  return {
    accepted: true,
    leader: {
      bidderEmail: leader.bidder_email,
      bidderName: leader.bidder_name,
      amount: leaderAmount,
      maxAmount: leader.max_amount ?? null,
      isChallenger: false,
    },
    challengerAmount: ceiling,
    outbid: {
      bidderEmail: incoming.bidderEmail,
      bidderName: incoming.bidderName,
      amount: ceiling,
    },
    nextMinimumBid: leaderAmount + incrementFor(leaderAmount, ladder, item.min_increment),
  }
}
