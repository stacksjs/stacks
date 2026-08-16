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
 *   engine/                 pure rules - increments, proxy bidding, anti-snipe, winners
 *   lots/ bids/ pledges/    persistence on top of those rules
 *   realtime, notifications how the room and the bidders find out
 *
 * Everything is in integer cents. See `./types` for the row shapes and why they
 * are declared here rather than imported from the generated ORM types.
 *
 * Both spellings work, since a file that only places bids should not have to
 * reach through two namespaces to do it:
 *
 *   commerce.auctions.placeBid(...)        flat, like every other commerce module
 *   commerce.auctions.bids.placeBid(...)   grouped, when a file touches several layers
 */

export * from './bids'
export * as bids from './bids'
export * from './engine'
export * as engine from './engine'
export * from './lots'
export * as lots from './lots'
export * from './notifications'
export * from './pledges'
export * as pledges from './pledges'
export * from './realtime'
export * from './rules'
export * from './types'
