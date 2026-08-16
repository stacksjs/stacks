/**
 * The pure auction engine.
 *
 * Nothing in here reads a clock, a config file or a database - every input is
 * an argument. That is what lets the interesting rules (a proxy-bid war, a tie,
 * an anti-snipe extension at the boundary, a reserve that was not met) be
 * tested exhaustively in milliseconds, and it is why the persistence layer in
 * `../bids` and `../auctions` stays as thin as it does.
 */

export { effectiveCloseAt, extendedCloseAt } from './anti-snipe'
export { DEFAULT_INCREMENT_LADDER, incrementFor, nextMinimumBid } from './increments'
export { resolveBid } from './proxy'
export type { IncomingBid, LeadingBid } from './proxy'
export { determineWinner, settle } from './winners'
