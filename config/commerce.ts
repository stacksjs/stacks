import type { CommerceConfig } from '@stacksjs/types'

/**
 * **Commerce Configuration**
 *
 * Controls the commerce feature bundle (Order, Cart, Product, Customer,
 * Coupon, GiftCard, Receipt, Shipping models + storefront API). Flip
 * `enabled` to `false` to leave the bundle inert at boot. Manage via
 * `./buddy commerce:install` / `./buddy commerce:uninstall` rather than
 * editing this file by hand.
 */
export default {
  enabled: true,

  /** Default storefront currency (ISO 4217). */
  currency: 'USD',

  /** Default tax rate applied when a product/region rule doesn't override. */
  defaultTaxRate: 0,

  /**
   * **Benefit auctions**
   *
   * Lots, proxy bidding, anti-sniping, fund-a-need pledges and settlement.
   * Part of commerce because everything downstream of the hammer - what sold,
   * for how much, who owes it, what gets receipted - is ordinary commerce.
   *
   * Every amount is integer minor units (cents). The timing fields are
   * defaults: an individual auction row overrides them, because a two-week
   * online catalogue and a ninety-minute in-room gala want different answers
   * and neither should have to be the global one.
   */
  auction: {
    enabled: true,

    /**
     * The bid-increment ladder. Read in order; the first rung whose `upTo`
     * exceeds the current bid applies, and the final `null` rung catches the
     * rest.
     *
     * A flat increment is wrong at both ends of a catalogue: $5 steps turn a
     * $4,000 travel package into a hundred-bid slog, and $100 steps price
     * everyone out of the $60 class art project.
     */
    increments: [
      { upTo: 5_000, step: 200 }, //      under $50   -> $2
      { upTo: 10_000, step: 500 }, //     under $100  -> $5
      { upTo: 25_000, step: 1_000 }, //   under $250  -> $10
      { upTo: 50_000, step: 2_500 }, //   under $500  -> $25
      { upTo: 100_000, step: 5_000 }, //  under $1k   -> $50
      { upTo: 250_000, step: 10_000 }, // under $2.5k -> $100
      { upTo: null, step: 25_000 }, //    above       -> $250
    ],

    /**
     * Anti-sniping. A bid dropped in the last four seconds wins not because it
     * was the highest anyone would pay, but because nobody could answer it.
     * Extending the close whenever a bid lands inside the window turns the last
     * minute back into an auction.
     */
    antiSnipeMinutes: 2,
    extendOnBidWindowMinutes: 2,

    /** Hard cap per lot, so a bidding war cannot run the gala until dawn. */
    maxExtensions: 20,
  },
} satisfies CommerceConfig
