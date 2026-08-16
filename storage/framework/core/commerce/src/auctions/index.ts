/**
 * Auctions.
 *
 * A benefit auction is commerce with the prices taken out: lots instead of
 * products, bidders instead of customers, and a hard stop time instead of a
 * checkout. It sits inside commerce because everything downstream of the
 * hammer - what was sold, for how much, who owes it, what gets receipted - is
 * ordinary commerce, and splitting the two would mean two vocabularies for one
 * night's money.
 *
 * Three layers, deliberately separable:
 *
 *   engine/          pure rules - increments, proxy bidding, anti-snipe, winners
 *   lots/ bids/ pledges/   persistence on top of those rules
 *   realtime, notifications  how the room and the bidders find out
 *
 * Everything is in integer cents. See `./types` for the row shapes and why they
 * are declared here rather than imported from the generated ORM types.
 */

import * as bids from './bids'
import * as engine from './engine'
import * as lots from './lots'
import * as pledges from './pledges'

export * from './bids'
export * from './engine'
export * from './lots'
export * from './notifications'
export * from './pledges'
export * from './realtime'
export * from './rules'
export * from './types'

export interface AuctionsNamespace {
  /** Auction lifecycle: open, close, settle, catalogue and totals. */
  lots: typeof lots
  bids: typeof bids
  engine: typeof engine
  pledges: typeof pledges
}

export const auctions: AuctionsNamespace = {
  lots,
  bids,
  engine,
  pledges,
}

export default auctions
