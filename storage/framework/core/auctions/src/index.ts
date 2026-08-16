/**
 * Stacks auctions.
 *
 * A benefit auction is not a storefront: nothing has a price, the money is a
 * donation, the bidding is against other people rather than against a checkout,
 * and the whole thing ends at a fixed time in a room full of people holding
 * phones. That is why this is its own package rather than a corner of
 * `@stacksjs/commerce`.
 *
 * Three layers, deliberately separable:
 *
 *   engine/  pure rules - increments, proxy bidding, anti-snipe, winners
 *   bids/, auctions/, pledges/  persistence on top of those rules
 *   realtime, notifications     how the room and the bidders find out
 *
 * Everything is in integer cents. See `./types` for the row shapes and why they
 * are declared here rather than imported from the generated ORM types.
 */

import * as auctions from './auctions'
import * as bids from './bids'
import * as engine from './engine'
import * as pledges from './pledges'

export * from './auctions'
export * from './bids'
export * from './engine'
export * from './notifications'
export * from './pledges'
export * from './realtime'
export * from './rules'
export * from './types'

export interface AuctionsNamespace {
  auctions: typeof auctions
  bids: typeof bids
  engine: typeof engine
  pledges: typeof pledges
}

/**
 * Namespaced surface, matching how `@stacksjs/commerce` is consumed:
 * `auction.bids.placeBid(...)` reads better in an action than a flat import
 * list once a file touches bidding, lifecycle and pledges at once.
 */
export const auction: AuctionsNamespace = {
  auctions,
  bids,
  engine,
  pledges,
}

export default auction
