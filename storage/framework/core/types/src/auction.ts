/**
 * One rung of the bid-increment ladder. Below `upTo` cents, bids step by
 * `step` cents; the final rung carries `upTo: null` and applies above all
 * others. Rungs are read in order, so they must stay sorted ascending.
 */
export interface AuctionIncrementTier {
  upTo: number | null
  step: number
}

/**
 * **Auction Options**
 *
 * Bidding defaults for the auction part of commerce (Auction / AuctionItem /
 * Bid / Pledge models, the proxy-bidding engine and the settlement report).
 * Configured under `commerce.auction` in `config/commerce.ts`.
 *
 * Individual auctions override the timing fields on their own row - one school
 * runs both a two-week online catalogue and a ninety-minute in-room gala, and
 * neither should have to be the global default.
 *
 * Every amount is integer minor units (cents).
 */
export interface AuctionOptions {
  /**
   * Gate for the auction surface on its own, inside an otherwise enabled
   * commerce bundle. A storefront that never runs a benefit auction sets this
   * to `false` and keeps its products, orders and carts.
   */
  enabled?: boolean
  /** Currency (ISO 4217). Falls back to the storefront's own currency. */
  currency?: string
  /**
   * The increment ladder. A flat increment is wrong at both ends of a
   * catalogue: $5 steps turn a $4,000 travel package into a hundred-bid slog,
   * and $100 steps price everyone out of the $60 class art project.
   */
  increments?: AuctionIncrementTier[]
  /** How far a lot's close is pushed out by an anti-snipe extension. */
  antiSnipeMinutes?: number
  /** How close to the close a bid must land to trigger an extension. */
  extendOnBidWindowMinutes?: number
  /** Hard cap on extensions per lot, so a bidding war cannot run all night. */
  maxExtensions?: number
}

export type AuctionConfig = Partial<AuctionOptions>
